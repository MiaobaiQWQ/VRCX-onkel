import { toast } from 'vue-sonner';

import {
    deleteVRChatCache as _deleteVRChatCache,
    isRealInstance
} from '../shared/utils';
import { database } from '../services/database';
import { useAdvancedSettingsStore } from '../stores/settings/advanced';
import { useAvatarStore } from '../stores/avatar';
import { addAvatarWearTime } from './avatarCoordinator';
import { useGameLogStore } from '../stores/gameLog';
import { useGameStore } from '../stores/game';
import { useGeneralSettingsStore } from '../stores/settings/general';
import { useInstanceStore } from '../stores/instance';
import { useLaunchStore } from '../stores/launch';
import { useLocationStore } from '../stores/location';
import { runLastLocationResetFlow } from './locationCoordinator';
import { useModalStore } from '../stores/modal';
import { useNotificationStore } from '../stores/notification';
import { useUpdateLoopStore } from '../stores/updateLoop';
import { useUserStore } from '../stores/user';
import { useVrStore } from '../stores/vr';
import { useWorldStore } from '../stores/world';

import configRepository from '../services/config';

import * as workerTimers from 'worker-timers';

/**
 * Runs shared side effects when game running state changes.
 * @param {boolean} isGameRunning Whether VRChat is running.
 */
export async function runGameRunningChangedFlow(isGameRunning) {
    const userStore = useUserStore();
    const instanceStore = useInstanceStore();
    const updateLoopStore = useUpdateLoopStore();
    const gameLogStore = useGameLogStore();
    const vrStore = useVrStore();
    const gameStore = useGameStore();

    if (isGameRunning) {
        userStore.markCurrentUserGameStarted();
    } else {
        await configRepository.setBool('isGameNoVR', gameStore.isGameNoVR);
        // persist last session data before markCurrentUserGameStopped resets $online_for
        const sessionStart = userStore.currentUser.$online_for;
        const offlineAt = Date.now();
        if (sessionStart && sessionStart > 0) {
            const sessionDuration = offlineAt - sessionStart;
            // set store state synchronously so UI reads it immediately
            gameStore.setLastSession(sessionDuration, offlineAt);
            await Promise.all([
                configRepository.setString(
                    'VRCX_lastGameSessionMs',
                    String(sessionDuration)
                ),
                configRepository.setString(
                    'VRCX_lastGameOfflineAt',
                    String(offlineAt)
                )
            ]);
        }
        userStore.markCurrentUserGameStopped();
        instanceStore.removeAllQueuedInstances();
        runAutoVRChatCacheManagementFlow();
        runCheckIfGameCrashedFlow();
        updateLoopStore.setIpcTimeout(0);
        addAvatarWearTime(userStore.currentUser.currentAvatar);
    }

    runLastLocationResetFlow();
    gameLogStore.clearNowPlaying();
    vrStore.updateVRLastLocation();
    workerTimers.setTimeout(() => runCheckVRChatDebugLoggingFlow(), 60000);
    updateLoopStore.setNextDiscordUpdate(0);
}

/**
 * Orchestrates the game running state update from IPC.
 * @param {boolean} isGameRunningArg Game running flag from IPC.
 * @param {boolean} isSteamVRRunningArg SteamVR running flag from IPC.
 */
export async function runUpdateIsGameRunningFlow(
    isGameRunningArg,
    isSteamVRRunningArg
) {
    const gameStore = useGameStore();
    const advancedSettingsStore = useAdvancedSettingsStore();
    const vrStore = useVrStore();

    if (advancedSettingsStore.gameLogDisabled) {
        return;
    }
    if (isGameRunningArg !== gameStore.isGameRunning) {
        gameStore.setIsGameRunning(isGameRunningArg);
        await runGameRunningChangedFlow(isGameRunningArg);
        console.log(new Date(), 'isGameRunning', isGameRunningArg);
    }

    if (isSteamVRRunningArg !== gameStore.isSteamVRRunning) {
        gameStore.setIsSteamVRRunning(isSteamVRRunningArg);
        console.log('isSteamVRRunning:', isSteamVRRunningArg);
    }
    vrStore.updateOpenVR();
}

/**
 * Orchestrates the HMD AFK state update from IPC.
 * @param {boolean} isHmdAfkArg HMD AFK flag from VR polling.
 */
export function runUpdateIsHmdAfkFlow(isHmdAfkArg) {
    const gameStore = useGameStore();

    if (isHmdAfkArg !== gameStore.isHmdAfk) {
        gameStore.setIsHmdAfk(isHmdAfkArg);
        console.log('isHmdAfk', isHmdAfkArg);
    }
}

/**
 * Runs auto cache management if enabled.
 */
function runAutoVRChatCacheManagementFlow() {
    const advancedSettingsStore = useAdvancedSettingsStore();

    if (advancedSettingsStore.autoSweepVRChatCache) {
        runSweepVRChatCacheFlow();
    }
}

/**
 * Sweeps VRChat cache and refreshes cache size display if config dialog visible.
 */
export async function runSweepVRChatCacheFlow() {
    const gameStore = useGameStore();
    const advancedSettingsStore = useAdvancedSettingsStore();

    try {
        const output = await AssetBundleManager.SweepCache();
        console.log('SweepCache', output);
    } catch (e) {
        console.error('SweepCache failed', e);
    }
    if (advancedSettingsStore.isVRChatConfigDialogVisible) {
        gameStore.getVRChatCacheSize();
    }
}

/**
 * Deletes VRChat cache for a given ref and refreshes related stores.
 * @param {object} ref Avatar or world reference payload.
 */
export async function runDeleteVRChatCacheFlow(ref) {
    const gameStore = useGameStore();
    const worldStore = useWorldStore();
    const avatarStore = useAvatarStore();

    await _deleteVRChatCache(ref);
    gameStore.getVRChatCacheSize();
    worldStore.updateVRChatWorldCache();
    avatarStore.updateVRChatAvatarCache();
}

/**
 * Checks if VRChat crashed and attempts to relaunch.
 */
export function runCheckIfGameCrashedFlow() {
    const advancedSettingsStore = useAdvancedSettingsStore();
    const locationStore = useLocationStore();
    const gameStore = useGameStore();

    if (!advancedSettingsStore.relaunchVRChatAfterCrash) {
        return;
    }
    const { location } = locationStore.lastLocation;
    AppApi.VrcClosedGracefully().then((result) => {
        if (result || !isRealInstance(location)) {
            return;
        }
        // check if relaunched less than 2mins ago (prevent crash loop)
        if (
            gameStore.state.lastCrashedTime &&
            new Date().getTime() - gameStore.state.lastCrashedTime.getTime() <
                120_000
        ) {
            console.log('VRChat was recently crashed, not relaunching');
            return;
        }
        gameStore.setLastCrashedTime(new Date());
        // wait a bit for SteamVR to potentially close before deciding to relaunch
        let restartDelay = 8000;
        if (gameStore.isGameNoVR) {
            // wait for game to close before relaunching
            restartDelay = 2000;
        }
        workerTimers.setTimeout(
            () => runRestartCrashedGameFlow(location),
            restartDelay
        );
    });
}

/**
 * Restarts VRChat after a crash.
 * @param {string} location Last known location to relaunch.
 */
function runRestartCrashedGameFlow(location) {
    const gameStore = useGameStore();
    const notificationStore = useNotificationStore();
    const gameLogStore = useGameLogStore();
    const launchStore = useLaunchStore();

    if (!gameStore.isGameNoVR && !gameStore.isSteamVRRunning) {
        console.log("SteamVR isn't running, not relaunching VRChat");
        return;
    }
    AppApi.FocusWindow();
    const message = 'VRChat crashed, attempting to rejoin last instance';
    toast(message);
    const entry = {
        created_at: new Date().toJSON(),
        type: 'Event',
        data: message
    };
    database.addGamelogEventToDatabase(entry);
    notificationStore.queueGameLogNoty(entry);
    gameLogStore.addGameLog(entry);
    launchStore.launchGame(location, '', gameStore.isGameNoVR);
}

/**
 * Checks and re-enables VRChat debug logging if disabled.
 */
export async function runCheckVRChatDebugLoggingFlow() {
    const gameStore = useGameStore();
    const advancedSettingsStore = useAdvancedSettingsStore();
    const modalStore = useModalStore();

    if (advancedSettingsStore.gameLogDisabled) {
        return;
    }
    try {
        const loggingEnabled =
            await gameStore.getVRChatRegistryKey('LOGGING_ENABLED');
        if (loggingEnabled === null || typeof loggingEnabled === 'undefined') {
            // key not found
            return;
        }
        if (parseInt(loggingEnabled, 10) === 1) {
            // already enabled
            return;
        }
        const result = await AppApi.SetVRChatRegistryKey(
            'LOGGING_ENABLED',
            '1',
            4
        );
        if (!result) {
            // failed to set key
            modalStore.alert({
                description:
                    'VRCX has noticed VRChat debug logging is disabled. VRCX requires debug logging in order to function correctly. Please enable debug logging in VRChat quick menu settings > debug > enable debug logging, then rejoin the instance or restart VRChat.',
                title: 'Enable debug logging'
            });
            console.error('Failed to enable debug logging', result);
            return;
        }
        modalStore.alert({
            description:
                'VRCX has noticed VRChat debug logging is disabled and automatically re-enabled it. VRCX requires debug logging in order to function correctly.',
            title: 'Enabled debug logging'
        });
        console.log('Enabled debug logging');
    } catch (e) {
        console.error(e);
    }
}

/**
 * Detects running VRChat clients and binds them to VRCX instances.
 * This ensures each VRCX instance only shows data for its corresponding VRChat client.
 */
export async function runDetectClientBindingFlow() {
    const generalSettingsStore = useGeneralSettingsStore();
    const userStore = useUserStore();

    if (typeof AppApi === 'undefined' || !AppApi.GetRunningVRChatClients) {
        return;
    }

    try {
        const clients = await AppApi.GetRunningVRChatClients();
        const currentUserId = userStore.currentUser?.id;

        for (const client of clients) {
            for (const instance of generalSettingsStore.extraInstances) {
                if (instance._index === 0) continue;
                if (instance.boundUserId && instance.boundUserId !== currentUserId) continue;
                if (instance.boundPid > 0 && instance.boundPid !== client.pid) continue;

                if (!instance.boundPlatform || instance.boundPlatform === client.platform) {
                    instance.boundPlatform = client.platform;
                    instance.boundPid = client.pid;
                    generalSettingsStore.saveExtraInstances();
                    console.log(`Bound instance ${instance._index} to ${client.platform} client (PID: ${client.pid})`);
                    break;
                }
            }
        }
    } catch (e) {
        console.error('Failed to detect VRChat clients:', e);
    }
}

/**
 * Checks if the current user's data should be displayed based on client binding.
 * @returns {boolean} True if data should be displayed for this instance.
 */
export function shouldDisplayUserData() {
    const generalSettingsStore = useGeneralSettingsStore();
    const userStore = useUserStore();
    const currentUserId = userStore.currentUser?.id;

    for (const instance of generalSettingsStore.extraInstances) {
        if (instance._index === 0) continue;
        if (instance.boundUserId && instance.boundUserId !== currentUserId) {
            return false;
        }
    }
    return true;
}

/**
 * Updates client binding when a VRChat client starts.
 * @param {object} monitoredProcess The process that started.
 */
export async function onVRChatClientStarted(monitoredProcess) {
    const generalSettingsStore = useGeneralSettingsStore();
    const userStore = useUserStore();

    if (monitoredProcess.ProcessName === 'vrchat' || monitoredProcess.ProcessName === 'vrserver') {
        const pid = monitoredProcess.Pid;
        const currentUserId = userStore.currentUser?.id;

        for (const instance of generalSettingsStore.extraInstances) {
            if (instance._index === 0) continue;
            if (instance.boundUserId && instance.boundUserId !== currentUserId) continue;
            if (instance.boundPid > 0) continue;

            instance.boundPid = pid;
            generalSettingsStore.saveExtraInstances();
            console.log(`Instance ${instance._index} bound to new VRChat client (PID: ${pid})`);
            break;
        }
    }
}

/**
 * Updates client binding when a VRChat client exits.
 * @param {object} monitoredProcess The process that exited.
 */
export function onVRChatClientExited(monitoredProcess) {
    const generalSettingsStore = useGeneralSettingsStore();
    const currentInstanceIndex = generalSettingsStore.extraInstances.find((i) => i._index === 0);

    for (const instance of generalSettingsStore.extraInstances) {
        if (instance._index === 0) continue;
        if (instance.boundPid === monitoredProcess.Pid) {
            instance.boundPid = 0;
            generalSettingsStore.saveExtraInstances();
            console.log(`VRChat client exited for instance ${instance._index} (PID: ${monitoredProcess.Pid})`);
            break;
        }
    }
}
