import { database } from '../services/database';
import { userRequest } from '../api';
import { useTrackedNonFriendsStore } from '../stores/trackedNonFriends';
import { useUserStore } from '../stores/user';
import { watchState } from '../services/watchState';
import { applyUser } from './userCoordinator';

export let isRunning = false;
let lastStartTime = 0;

/**
 * Refresh bio and status for all tracked non-friends (L4 level, ~hourly).
 * Fetches fresh user data from the VRChat API and records changes.
 */
export async function refreshTrackedNonFriendsFlow() {
    if (!watchState.isLoggedIn) return;
    
    // Safety: If running for more than 5 minutes, force reset
    if (isRunning && Date.now() - lastStartTime > 300000) {
        console.warn('[NonFriendRefresh] 刷新超时（>5分钟），强制重置锁状态');
        isRunning = false;
    }

    if (isRunning) {
        console.warn('[NonFriendRefresh] 刷新已在运行中，跳过本次请求');
        return;
    }

    isRunning = true;
    lastStartTime = Date.now();
    try {
        const trackedStore = useTrackedNonFriendsStore();
        const userStore = useUserStore();
        
        // Always reload list from DB to ensure we have latest IDs
        await trackedStore.loadTrackedNonFriends();

        const tracked = [...trackedStore.trackedList];
        if (tracked.length === 0) {
            console.log('[NonFriendRefresh] 追踪列表为空，无需刷新');
            return;
        }

        console.log(`[NonFriendRefresh] 开始刷新 ${tracked.length} 位追踪非好友的数据`);

        let hasChanges = false;
        for (let i = 0; i < tracked.length; i++) {
            const entry = tracked[i];
            const userId = entry.userId;
            
            // Add a small delay between requests to be nice to the API
            if (i > 0) {
                await new Promise(r => setTimeout(r, 200));
            }

            try {
                const result = await userRequest.getUser({ userId });
                const ref = result?.ref;
                if (!ref) {
                    console.warn(`[NonFriendRefresh] 无法获取用户 ${userId} 的详情`);
                    continue;
                }

                // Cache the user data so UI can use it immediately
                applyUser(ref);

                const displayName = ref.displayName || entry.displayName;

                // Update display name in DB if changed or previously missing
                if (displayName && (displayName !== entry.displayName || !entry.displayName)) {
                    await database.updateTrackedNonFriendDisplayName(userId, displayName);
                    hasChanges = true;
                }

                // Record bio change
                const currentBio = ref.bio || '';
                const lastBio = await database.getLastBioChangeForUser(userId);
                if (!lastBio || lastBio.bio !== currentBio) {
                    database.addBioToDatabase({
                        created_at: new Date().toISOString(),
                        userId,
                        displayName,
                        bio: currentBio,
                        previousBio: lastBio ? lastBio.bio : ''
                    });
                }

                // Record status change
                const currentStatus = ref.status || '';
                const currentStatusDesc = ref.statusDescription || '';
                const validStatuses = ['join me', 'active', 'ask me', 'busy', 'online', 'offline'];
                if (validStatuses.includes(currentStatus)) {
                    const lastStatus = await database.getLastStatusChangeForUser(userId);
                    if (!lastStatus || lastStatus.status !== currentStatus || lastStatus.statusDescription !== currentStatusDesc) {
                        database.addStatusToDatabase({
                            created_at: new Date().toISOString(),
                            userId,
                            displayName,
                            status: currentStatus,
                            statusDescription: currentStatusDesc,
                            previousStatus: lastStatus ? lastStatus.status : '',
                            previousStatusDescription: lastStatus ? lastStatus.statusDescription : ''
                        });
                    }
                }

                /* 
                // Record Online/Offline change
                const lastOnlineOffline = await database.getLastOnlineOfflineForUser(userId);
                const currentState = ref.state || 'offline';
                if (!lastOnlineOffline || lastOnlineOffline.type.toLowerCase() !== currentState) {
                    database.addOnlineOfflineToDatabase({
                        created_at: new Date().toISOString(),
                        userId,
                        displayName,
                        type: currentState === 'online' || currentState === 'active' ? 'Online' : 'Offline',
                        location: ref.location || '',
                        worldName: ref.worldName || '',
                        time: 0,
                        groupName: ref.groupName || ''
                    });
                }

                // Record location change (GPS)
                const currentLocation = ref.location || '';
                const currentWorldName = ref.worldName || '';
                if (currentLocation && currentLocation !== 'offline' && currentLocation !== 'private' && currentState !== 'offline') {
                    const lastGps = await database.getLastGPSChangeForUser(userId);
                    if (!lastGps || lastGps.location !== currentLocation) {
                        database.addGPSToDatabase({
                            created_at: new Date().toISOString(),
                            userId,
                            displayName,
                            location: currentLocation,
                            worldName: currentWorldName,
                            previousLocation: lastGps ? lastGps.location : '',
                            time: 0,
                            groupName: ref.groupName || ''
                        });
                    }
                }
                */
            } catch (err) {
                console.error(`[NonFriendRefresh] 刷新用户 ${userId} 失败`, err);
            }
        }

        if (hasChanges) {
            await trackedStore.loadTrackedNonFriends();
        }
    } finally {
        isRunning = false;
    }
}
