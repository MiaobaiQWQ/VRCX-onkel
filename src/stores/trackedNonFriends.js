import { defineStore } from 'pinia';
import { ref, shallowRef, watch } from 'vue';
import { useLocalStorage } from '@vueuse/core';

import { database } from '../services/database';
import { watchState } from '../services/watchState';

export const useTrackedNonFriendsStore = defineStore('TrackedNonFriends', () => {
    /** @type {import('vue').Ref<Array<{userId: string, displayName: string, addedAt: string}>>} */
    const trackedList = shallowRef([]);
    /** @type {import('vue').Ref<Set<string>>} */
    const trackedSet = ref(new Set());
    const isLoaded = ref(false);
    const changeCounts = ref(new Map());

    const autoTrackNewUsers = useLocalStorage('vrcx-auto-track-new-users', false);
    const autoTrackOnWorldJoin = useLocalStorage('vrcx-auto-track-on-world-join', false);
    const autoRemoveOnFriendAdd = useLocalStorage('vrcx-auto-remove-on-friend-add', false);

    watch(
        () => watchState.isLoggedIn,
        (isLoggedIn) => {
            if (isLoggedIn) {
                loadTrackedNonFriends();
            } else {
                trackedList.value = [];
                trackedSet.value = new Set();
                isLoaded.value = false;
            }
        },
        { immediate: true }
    );

    /**
     * Load tracked non-friends from database.
     */
    async function loadTrackedNonFriends() {
        const rows = await database.getTrackedNonFriends();
        trackedList.value = rows;
        trackedSet.value = new Set(rows.map((r) => r.userId));
        
        // Also load all change counts at once
        const counts = await database.getAllTrackedNonFriendChangeCounts();
        changeCounts.value = counts;
        
        isLoaded.value = true;
    }

    /**
     * Add a user to the tracked non-friends list.
     * @param {string} userId
     * @param {string} displayName
     * @param {string} location
     * @param {string} bio
     */
    async function addTrackedNonFriend(userId, displayName, location, bio) {
        if (trackedSet.value.has(userId)) return;
        await database.addTrackedNonFriend(userId, displayName, location);
        
        // Record initial bio if provided
        if (typeof bio === 'string') {
            const lastBio = await database.getLastBioChangeForUser(userId);
            if (!lastBio || lastBio.bio !== bio) {
                await database.addBioToDatabase({
                    created_at: new Date().toISOString(),
                    userId,
                    displayName,
                    bio,
                    previousBio: lastBio ? lastBio.bio : ''
                });
            }
        }
        
        await loadTrackedNonFriends();
    }

    /**
     * Remove a user from the tracked non-friends list.
     * @param {string} userId
     */
    async function removeTrackedNonFriend(userId) {
        await database.removeTrackedNonFriend(userId);
        await loadTrackedNonFriends();
    }

    /**
     * Toggle tracking for a user.
     * @param {string} userId
     * @param {string} displayName
     * @param {string} location
     * @param {string} bio
     */
    async function toggleTrackedNonFriend(userId, displayName, location, bio) {
        if (trackedSet.value.has(userId)) {
            await removeTrackedNonFriend(userId);
        } else {
            await addTrackedNonFriend(userId, displayName, location, bio);
        }
    }

    /**
     * Check if a user is tracked.
     * @param {string} userId
     */
    function isTracked(userId) {
        return trackedSet.value.has(userId);
    }

    return {
        trackedList,
        trackedSet,
        changeCounts,
        isLoaded,
        autoTrackNewUsers,
        autoTrackOnWorldJoin,
        autoRemoveOnFriendAdd,
        loadTrackedNonFriends,
        addTrackedNonFriend,
        removeTrackedNonFriend,
        toggleTrackedNonFriend,
        isTracked
    };
});
