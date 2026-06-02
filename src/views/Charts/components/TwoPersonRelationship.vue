<template>
    <div id="chart" ref="twoPersonRef" class="x-container">
        <div class="pt-4 pb-8">
            <BackToTop :target="twoPersonRef" :right="30" :bottom="30" :teleport="false" />

            <div class="flex items-center justify-between gap-2 mb-2">
                <div class="flex items-center gap-2">
                    <span class="shrink-0">{{ t('view.charts.two_person_relationship.header') }}</span>
                    <HoverCard>
                        <HoverCardTrigger as-child>
                            <Info class="ml-1 text-xs opacity-70" />
                        </HoverCardTrigger>
                        <HoverCardContent side="bottom" align="start" class="w-80">
                            <div class="text-xs">
                                {{ t('view.charts.two_person_relationship.tips.description') }}
                            </div>
                        </HoverCardContent>
                    </HoverCard>
                </div>
                <Button variant="outline" size="sm" class="h-8 gap-1" @click="addQuery">
                    <Plus class="size-3.5" />
                    {{ t('view.charts.two_person_relationship.add_query') }}
                </Button>
            </div>

            <Tabs v-model="activeQueryId" class="w-full">
                <TabsList
                    class="flex w-full justify-start h-auto p-1 bg-transparent border-b rounded-none gap-1 overflow-x-auto no-scrollbar">
                    <TabsTrigger
                        v-for="(query, index) in queries"
                        :key="query.id"
                        :value="query.id"
                        class="relative h-9 px-4 py-2 bg-transparent data-[state=active]:bg-accent data-[state=active]:shadow-none border border-transparent data-[state=active]:border-border rounded-md transition-all group shrink-0">
                        <span class="text-xs font-medium">{{ getQueryTitle(query, index) }}</span>
                        <Button
                            v-if="queries.length > 1"
                            variant="ghost"
                            size="icon"
                            class="ml-2 -mr-2 size-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            @click.stop="removeQuery(query.id)">
                            <X class="size-3" />
                        </Button>
                    </TabsTrigger>
                </TabsList>

                <TabsContent :value="activeQueryId" class="mt-0 outline-none">
                    <div class="options-container mt-4 flex flex-col gap-2">
                        <div class="flex items-center gap-2">
                            <!-- Friend Selector A -->
                            <div class="min-w-0 flex-1">
                                <VirtualCombobox
                                    :model-value="selectedFriendAId"
                                    @update:modelValue="handleFriendASelect"
                                    :groups="friendPickerGroupsA"
                                    :placeholder="t('view.charts.two_person_relationship.select_friend_a')"
                                    :search-placeholder="t('view.charts.two_person_relationship.search_friend')"
                                    :close-on-select="true"
                                    :deselect-on-reselect="true">
                                    <template #item="{ item, selected }">
                                        <div
                                            class="flex w-full items-center p-1.5 in-[.is-compact-table]:p-1! text-[13px] in-[.is-compact-table]:text-[12px]!">
                                            <template v-if="item.user">
                                                <div
                                                    class="relative mr-2.5 in-[.is-compact-table]:mr-1.5! inline-block size-9 in-[.is-compact-table]:size-7! in-[.is-comfortable-table]:size-8! flex-none"
                                                    :class="userStatusClass(item.user)">
                                                    <img
                                                        class="size-full rounded-full object-cover"
                                                        :src="userImage(item.user)"
                                                        loading="lazy" />
                                                </div>
                                                <div class="flex-1 overflow-hidden">
                                                    <span
                                                        class="block truncate font-medium leading-[18px]"
                                                        :style="{ color: item.user.$userColour }">
                                                        {{ item.user.displayName }}
                                                    </span>
                                                </div>
                                            </template>
                                            <template v-else>
                                                <span>{{ item.label }}</span>
                                            </template>
                                            <Check
                                                :class="['ml-auto size-4', selected ? 'opacity-100' : 'opacity-0']" />
                                        </div>
                                    </template>
                                </VirtualCombobox>
                            </div>

                            <TooltipWrapper :content="t('view.charts.two_person_relationship.swap_friends')" side="top">
                                <Button
                                    class="shrink-0 rounded-full"
                                    size="icon"
                                    variant="ghost"
                                    :disabled="!selectedFriendAId && !selectedFriendBId"
                                    @click="swapFriends">
                                    <ArrowLeftRight class="size-4" />
                                </Button>
                            </TooltipWrapper>

                            <!-- Friend Selector B -->
                            <div class="min-w-0 flex-1">
                                <VirtualCombobox
                                    :model-value="selectedFriendBId"
                                    @update:modelValue="handleFriendBSelect"
                                    :groups="friendPickerGroupsB"
                                    :placeholder="t('view.charts.two_person_relationship.select_friend_b')"
                                    :search-placeholder="t('view.charts.two_person_relationship.search_friend')"
                                    :close-on-select="true"
                                    :deselect-on-reselect="true">
                                    <template #item="{ item, selected }">
                                        <div
                                            class="flex w-full items-center p-1.5 in-[.is-compact-table]:p-1! text-[13px] in-[.is-compact-table]:text-[12px]!">
                                            <template v-if="item.user">
                                                <div
                                                    class="relative mr-2.5 in-[.is-compact-table]:mr-1.5! inline-block size-9 in-[.is-compact-table]:size-7! in-[.is-comfortable-table]:size-8! flex-none"
                                                    :class="userStatusClass(item.user)">
                                                    <img
                                                        class="size-full rounded-full object-cover"
                                                        :src="userImage(item.user)"
                                                        loading="lazy" />
                                                </div>
                                                <div class="flex-1 overflow-hidden">
                                                    <span
                                                        class="block truncate font-medium leading-[18px]"
                                                        :style="{ color: item.user.$userColour }">
                                                        {{ item.user.displayName }}
                                                    </span>
                                                </div>
                                            </template>
                                            <template v-else>
                                                <span>{{ item.label }}</span>
                                            </template>
                                            <Check
                                                :class="['ml-auto size-4', selected ? 'opacity-100' : 'opacity-0']" />
                                        </div>
                                    </template>
                                </VirtualCombobox>
                            </div>

                            <!-- Refresh Button -->
                            <TooltipWrapper :content="t('view.charts.two_person_relationship.refresh')" side="top">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    class="shrink-0 rounded-full"
                                    :disabled="!selectedFriendAId || !selectedFriendBId || isLoading"
                                    @click="loadData">
                                    <RefreshCcw :class="['size-4', isLoading ? 'animate-spin' : '']" />
                                </Button>
                            </TooltipWrapper>

                            <div class="ml-auto flex shrink-0 items-center gap-2 px-0.5">
                                <span class="shrink-0 text-sm">
                                    {{ t('view.charts.two_person_relationship.show_self_presence') }}
                                </span>
                                <Switch v-model="showSelfPresence" />
                            </div>
                        </div>
                    </div>

                    <!-- Real-time Status Banner -->
                    <div
                        v-if="selectedFriendAId && selectedFriendBId && !isLoading"
                        class="mx-auto mt-4 max-w-[900px]">
                        <div
                            :class="[
                                'flex items-center justify-between p-4 rounded-xl border transition-all shadow-sm',
                                isSameRoom
                                    ? 'bg-blue-500/10 border-blue-200 dark:border-blue-800'
                                    : 'bg-card border-border'
                            ]">
                            <div class="flex items-center gap-4 flex-1 min-w-0">
                                <div class="flex -space-x-3 shrink-0">
                                    <div
                                        class="relative size-10 rounded-full border-2 border-background overflow-hidden"
                                        :class="userStatusClass(friendAUser)">
                                        <img
                                            :src="userImage(friendAUser)"
                                            class="size-full object-cover"
                                            loading="lazy" />
                                    </div>
                                    <div
                                        class="relative size-10 rounded-full border-2 border-background overflow-hidden"
                                        :class="userStatusClass(friendBUser)">
                                        <img
                                            :src="userImage(friendBUser)"
                                            class="size-full object-cover"
                                            loading="lazy" />
                                    </div>
                                </div>
                                <div class="min-w-0 flex-1">
                                    <div class="flex items-center gap-2">
                                        <span class="font-bold truncate text-sm">{{
                                            friendAUser?.displayName || '...'
                                        }}</span>
                                        <span class="text-muted-foreground text-xs">&</span>
                                        <span class="font-bold truncate text-sm">{{
                                            friendBUser?.displayName || '...'
                                        }}</span>
                                    </div>
                                    <div class="mt-0.5 text-xs">
                                        <template v-if="isSameRoom">
                                            <span
                                                class="text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1.5">
                                                <div class="size-2 rounded-full bg-blue-500 animate-pulse"></div>
                                                {{ t('view.charts.two_person_relationship.status.in_same_room') }}
                                            </span>
                                            <div class="mt-1">
                                                <Location
                                                    :location="friendALocation"
                                                    class="text-xs font-medium" />
                                            </div>
                                        </template>
                                        <template v-else>
                                            <span class="text-muted-foreground font-medium">
                                                {{ t('view.charts.two_person_relationship.status.not_together') }}
                                            </span>
                                            <div class="mt-1 flex flex-col gap-1 opacity-80">
                                                <div
                                                    v-if="friendALocation && friendALocation !== 'offline'"
                                                    class="flex items-center gap-1.5 overflow-hidden">
                                                    <span class="shrink-0 opacity-60 text-[10px]"
                                                        >{{ friendAUser.displayName }}:</span
                                                    >
                                                    <Location
                                                        :location="friendALocation"
                                                        class="text-[10px] truncate" />
                                                </div>
                                                <div
                                                    v-if="friendBLocation && friendBLocation !== 'offline'"
                                                    class="flex items-center gap-1.5 overflow-hidden">
                                                    <span class="shrink-0 opacity-60 text-[10px]"
                                                        >{{ friendBUser.displayName }}:</span
                                                    >
                                                    <Location
                                                        :location="friendBLocation"
                                                        class="text-[10px] truncate" />
                                                </div>
                                            </div>
                                        </template>
                                    </div>
                                </div>
                            </div>

                            <div v-if="isSameRoom" class="shrink-0 ml-4">
                                <Button
                                    size="sm"
                                    class="h-8 text-xs px-3"
                                    @click="openInstanceDialog(friendALocation)">
                                    {{ t('view.charts.two_person_relationship.status.view_instance') }}
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div v-if="isLoading" class="mt-[100px] flex items-center justify-center">
                        <RefreshCcw class="size-6 animate-spin text-muted-foreground" />
                    </div>

                    <div
                        v-else-if="!selectedFriendAId || !selectedFriendBId"
                        class="mt-[100px] flex flex-col items-center justify-center gap-2 text-muted-foreground">
                        <Users class="size-12 opacity-20" />
                        <p>{{ t('view.charts.two_person_relationship.no_friend_selected') }}</p>
                    </div>

                    <div
                        v-else-if="sharedInstances.length === 0"
                        class="mt-[100px] flex flex-col items-center justify-center gap-2 text-muted-foreground">
                        <DataTableEmpty type="nodata" />
                    </div>

                    <template v-else>
                        <div
                            class="mx-auto mt-3 in-[.is-compact-table]:mt-1.5! in-[.is-comfortable-table]:mt-2! flex max-w-[900px] items-center gap-3">
                            <div
                                class="flex items-center gap-2 rounded-lg border px-3 py-2 in-[.is-compact-table]:py-1! in-[.is-comfortable-table]:py-1.5!">
                                <Clock class="size-3.5 text-muted-foreground" />
                                <span class="text-sm in-[.is-compact-table]:text-xs! font-medium">{{
                                    timeToText(totalCoexistenceTime, true)
                                }}</span>
                                <span class="text-xs text-muted-foreground">
                                    {{ t('view.charts.two_person_relationship.total_coexistence_time') }}
                                </span>
                            </div>
                            <div
                                class="flex items-center gap-2 rounded-lg border px-3 py-2 in-[.is-compact-table]:py-1! in-[.is-comfortable-table]:py-1.5!">
                                <Hash class="size-3.5 text-muted-foreground" />
                                <span class="text-sm in-[.is-compact-table]:text-xs! font-medium">{{
                                    sharedInstances.length
                                }}</span>
                                <span class="text-xs text-muted-foreground">
                                    {{ t('view.charts.two_person_relationship.instance_count') }}
                                </span>
                            </div>
                        </div>

                        <div
                            class="mx-auto mt-3 in-[.is-compact-table]:mt-1.5! in-[.is-comfortable-table]:mt-2! max-w-[900px] flex flex-col gap-3 pb-8">
                            <button
                                v-for="item in sharedInstances"
                                :key="item.location + '_' + item.friendALeave"
                                type="button"
                                class="group flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all hover:bg-accent hover:shadow-sm"
                                @click="openInstanceDialog(item.location)">
                                <div class="w-32 shrink-0 text-xs text-muted-foreground tabular-nums">
                                    {{ item.formattedDate }}
                                </div>

                                <div class="min-w-0 flex-1">
                                    <Location :location="item.location" />
                                    <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                                        <TooltipWrapper
                                            v-if="item.instanceCreatorName"
                                            :content="t('view.charts.two_person_relationship.instance_creator')"
                                            side="top">
                                            <span class="flex items-center gap-1 text-xs text-muted-foreground">
                                                <Crown class="size-3 shrink-0" />
                                                <span class="truncate max-w-[120px]">{{ item.instanceCreatorName }}</span>
                                            </span>
                                        </TooltipWrapper>
                                        <TooltipWrapper
                                            v-if="item.maxPlayerCount != null"
                                            :content="t('view.charts.two_person_relationship.max_player_count')"
                                            side="top">
                                            <span class="flex items-center gap-1 text-xs text-muted-foreground">
                                                <Users class="size-3 shrink-0" />
                                                <span class="tabular-nums">{{ item.maxPlayerCount }}</span>
                                            </span>
                                        </TooltipWrapper>
                                    </div>
                                </div>

                                <div class="flex shrink-0 flex-col items-end gap-1.5">
                                    <div class="flex items-center gap-1.5 text-xs text-muted-foreground mr-1">
                                        <Clock class="size-3 shrink-0" />
                                        <span class="font-medium tabular-nums">{{
                                            timeToText(item.coexistenceTime, true)
                                        }}</span>
                                    </div>

                                    <div class="flex items-center gap-2">
                                        <span
                                            v-if="showSelfPresence"
                                            :class="[
                                                'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium leading-none',
                                                item.selfPresent
                                                    ? 'bg-green-500/15 text-green-600 dark:text-green-400'
                                                    : 'bg-red-500/15 text-red-600 dark:text-red-400'
                                            ]">
                                            {{
                                                item.selfPresent
                                                    ? t('view.charts.two_person_relationship.self_present')
                                                    : t('view.charts.two_person_relationship.self_not_present')
                                            }}
                                        </span>
                                        <span
                                            :class="[
                                                'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium leading-none',
                                                item.initiator === 'mutual'
                                                    ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                                                    : item.initiator === 'unknown'
                                                        ? 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800'
                                                        : 'text-orange-600 dark:text-orange-400'
                                            ]"
                                            :style="
                                                item.initiator === 'leftPlayer'
                                                    ? {
                                                          background:
                                                              'linear-gradient(to right, rgb(249 115 22 / 0.3), rgb(249 115 22 / 0))'
                                                      }
                                                    : item.initiator === 'rightPlayer'
                                                        ? {
                                                              background:
                                                                  'linear-gradient(to left, rgb(249 115 22 / 0.3), rgb(249 115 22 / 0))'
                                                          }
                                                        : {}
                                            ">
                                            {{ t('view.charts.two_person_relationship.initiator_' + item.initiator) }}
                                        </span>
                                    </div>
                                </div>
                            </button>
                        </div>
                    </template>
                </TabsContent>
            </Tabs>
        </div>
    </div>
</template>

<script setup>
    defineOptions({ name: 'ChartsTwoPersonRelationship' });

    import { computed, onMounted, ref, watch } from 'vue';
    import {
        ArrowLeftRight,
        Check,
        Clock,
        Crown,
        Hash,
        Info,
        Plus,
        RefreshCcw,
        Users,
        X
    } from 'lucide-vue-next';
    import { storeToRefs } from 'pinia';
    import { useI18n } from 'vue-i18n';
    import dayjs from 'dayjs';

    import BackToTop from '@/components/BackToTop.vue';
    import { Button } from '@/components/ui/button';
    import { DataTableEmpty } from '@/components/ui/data-table';
    import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
    import { Switch } from '@/components/ui/switch';
    import { VirtualCombobox } from '@/components/ui/virtual-combobox';
    import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
    import TooltipWrapper from '@/components/ui/tooltip/TooltipWrapper.vue';
    import Location from '@/components/Location.vue';

    import { showWorldDialog } from '@/coordinators/worldCoordinator';
    import { database } from '@/services/database';
    import { parseLocation } from '@/shared/utils/locationParser';
    import { timeToText } from '@/shared/utils';
    import { useAppearanceSettingsStore, useFriendStore, useTrackedNonFriendsStore, useUserStore } from '@/stores';
    import { useUserDisplay } from '@/composables/useUserDisplay';

    import { useLocalStorage } from '@vueuse/core';

    const { t } = useI18n();

    const twoPersonRef = ref(null);

    const persistedQueries = useLocalStorage('vrcx-two-person-queries', [
        {
            id: Date.now(),
            selectedFriendAId: null,
            selectedFriendBId: null
        }
    ]);

    const queries = ref(persistedQueries.value.map((q) => ({
        id: q.id,
        selectedFriendAId: q.selectedFriendAId,
        selectedFriendBId: q.selectedFriendBId,
        isLoading: false,
        rawResults: [],
        selfPresenceMap: new Map(),
        maxPlayerCountMap: new Map()
    })));

    watch(queries, (newVal) => {
        persistedQueries.value = newVal.map((q) => ({
            id: q.id,
            selectedFriendAId: q.selectedFriendAId,
            selectedFriendBId: q.selectedFriendBId
        }));
    }, { deep: true });

    const activeQueryId = useLocalStorage('vrcx-two-person-active-query-id', queries.value[0].id);
    const activeQuery = computed(() => {
        const query = queries.value.find((q) => q.id === activeQueryId.value);
        if (query) return query;
        const fallback = queries.value[0];
        activeQueryId.value = fallback.id;
        return fallback;
    });

    const selectedFriendAId = computed({
        get: () => activeQuery.value.selectedFriendAId,
        set: (val) => (activeQuery.value.selectedFriendAId = val)
    });
    const selectedFriendBId = computed({
        get: () => activeQuery.value.selectedFriendBId,
        set: (val) => (activeQuery.value.selectedFriendBId = val)
    });
    const isLoading = computed({
        get: () => activeQuery.value.isLoading,
        set: (val) => (activeQuery.value.isLoading = val)
    });
    const rawResults = computed({
        get: () => activeQuery.value.rawResults,
        set: (val) => (activeQuery.value.rawResults = val)
    });
    const selfPresenceMap = computed({
        get: () => activeQuery.value.selfPresenceMap,
        set: (val) => (activeQuery.value.selfPresenceMap = val)
    });
    const maxPlayerCountMap = computed({
        get: () => activeQuery.value.maxPlayerCountMap,
        set: (val) => (activeQuery.value.maxPlayerCountMap = val)
    });

    const showSelfPresence = useLocalStorage('vrcx-two-person-show-self-presence', false);

    function addQuery() {
        const newQuery = {
            id: Date.now(),
            selectedFriendAId: null,
            selectedFriendBId: null,
            isLoading: false,
            rawResults: [],
            selfPresenceMap: new Map(),
            maxPlayerCountMap: new Map()
        };
        queries.value.push(newQuery);
        activeQueryId.value = newQuery.id;
    }

    function removeQuery(queryId) {
        if (queries.value.length <= 1) return;
        const index = queries.value.findIndex((q) => q.id === queryId);
        if (index !== -1) {
            queries.value.splice(index, 1);
            if (activeQueryId.value === queryId) {
                activeQueryId.value = queries.value[Math.max(0, index - 1)].id;
            }
        }
    }

    function getQueryTitle(query, index) {
        if (query.selectedFriendAId && query.selectedFriendBId) {
            const nameA = resolveDisplayName(query.selectedFriendAId);
            const nameB = resolveDisplayName(query.selectedFriendBId);
            return t('view.charts.two_person_relationship.query_vs', { friendA: nameA, friendB: nameB });
        }
        return t('view.charts.two_person_relationship.query_title', { index: index + 1 });
    }

    const appearanceStore = useAppearanceSettingsStore();
    const { dtHour12 } = storeToRefs(appearanceStore);
    const friendStore = useFriendStore();
    const userStore = useUserStore();
    const trackedStore = useTrackedNonFriendsStore();
    const { friends } = storeToRefs(friendStore);
    const { trackedList } = storeToRefs(trackedStore);
    const { currentUser } = storeToRefs(userStore);
    const cachedUsers = userStore.cachedUsers;

    const { userImage, userStatusClass } = useUserDisplay();

    const friendAStatus = computed(() => {
        if (!selectedFriendAId.value) return null;
        return friends.value.get(selectedFriendAId.value) || cachedUsers.get(selectedFriendAId.value);
    });

    const friendBStatus = computed(() => {
        if (!selectedFriendBId.value) return null;
        return friends.value.get(selectedFriendBId.value) || cachedUsers.get(selectedFriendBId.value);
    });

    const friendAUser = computed(() => {
        if (!friendAStatus.value) return null;
        return friendAStatus.value.ref || friendAStatus.value;
    });

    const friendBUser = computed(() => {
        if (!friendBStatus.value) return null;
        return friendBStatus.value.ref || friendBStatus.value;
    });

    const isSameRoom = computed(() => {
        const userA = friendAUser.value;
        const userB = friendBUser.value;
        if (!userA || !userB) return false;

        const locA = userA.$location?.tag || userA.location;
        const locB = userB.$location?.tag || userB.location;

        if (
            !locA ||
            !locB ||
            locA === 'offline' ||
            locB === 'offline' ||
            locA === 'private' ||
            locB === 'private' ||
            locA === 'traveling' ||
            locB === 'traveling'
        )
            return false;
        return locA === locB;
    });

    const friendALocation = computed(() => friendAUser.value?.$location?.tag || friendAUser.value?.location);
    const friendBLocation = computed(() => friendBUser.value?.$location?.tag || friendBUser.value?.location);

    function buildFriendItems(excludeId) {
        return allFriendItems.value.filter((item) => item.value !== excludeId);
    }

    const allFriendItems = computed(() => {
        const items = [];
        const seenIds = new Set();
        const selfId = currentUser.value?.id;

        // 1. Friends
        for (const [friendId, friend] of friends.value.entries()) {
            if (friendId === selfId) continue;
            const cached = cachedUsers.get(friendId);
            const displayName = friend.displayName || cached?.displayName || friendId;
            items.push({
                value: friendId,
                label: displayName,
                search: displayName,
                user: cached || null
            });
            seenIds.add(friendId);
        }

        // 2. Tracked Non-Friends
        for (const item of trackedList.value) {
            if (item.userId === selfId || seenIds.has(item.userId)) continue;
            const cached = cachedUsers.get(item.userId);
            const displayName = item.displayName || cached?.displayName || item.userId;
            items.push({
                value: item.userId,
                label: displayName,
                search: displayName,
                user: cached || null
            });
            seenIds.add(item.userId);
        }

        items.sort((a, b) => a.label.localeCompare(b.label));
        return items;
    });

    const friendPickerGroupsA = computed(() => [
        {
            key: 'friends',
            label: t('side_panel.friends'),
            items: selectedFriendBId.value ? buildFriendItems(selectedFriendBId.value) : allFriendItems.value
        }
    ]);
    const friendPickerGroupsB = computed(() => [
        {
            key: 'friends',
            label: t('side_panel.friends'),
            items: selectedFriendAId.value ? buildFriendItems(selectedFriendAId.value) : allFriendItems.value
        }
    ]);

    function resolveDisplayName(userId) {
        if (!userId) return null;
        const cached = cachedUsers.get(userId);
        return cached?.displayName || userId;
    }

    function computeSelfPresent(location, overlapStart, overlapEnd) {
        const sessions = selfPresenceMap.value.get(location);
        if (!sessions || sessions.length === 0) return false;
        for (const session of sessions) {
            const selfLeaveMs = dayjs(session.selfLeave).valueOf();
            const selfJoinMs = selfLeaveMs - Math.max(0, session.selfTime);
            if (selfJoinMs < overlapEnd && selfLeaveMs > overlapStart) {
                return true;
            }
        }
        return false;
    }

    const sharedInstances = computed(() => {
        const dateFormat = dtHour12.value ? 'YYYY-MM-DD hh:mm A' : 'YYYY-MM-DD HH:mm';
        const THREE_MINUTES = 3 * 60 * 1000;

        const firstMeetingByLocation = new Map();
        for (const row of rawResults.value) {
            const aLeave = dayjs(row.friendALeave).valueOf();
            const bLeave = dayjs(row.friendBLeave).valueOf();
            const aJoin = aLeave - Math.max(0, row.friendATime);
            const bJoin = bLeave - Math.max(0, row.friendBTime);
            const overlapStart = Math.max(aJoin, bJoin);
            const existing = firstMeetingByLocation.get(row.location);
            if (!existing || overlapStart < existing.overlapStart) {
                firstMeetingByLocation.set(row.location, { overlapStart, aJoin, bJoin });
            }
        }

        const results = [];

        rawResults.value.forEach((row) => {
            const friendATime = Math.max(0, row.friendATime);
            const friendBTime = Math.max(0, row.friendBTime);
            const friendALeaveMs = dayjs(row.friendALeave).valueOf();
            const friendAJoin = friendALeaveMs - friendATime;
            const friendBLeaveMs = dayjs(row.friendBLeave).valueOf();
            const friendBJoin = friendBLeaveMs - friendBTime;
            const overlapStart = Math.max(friendAJoin, friendBJoin);
            const overlapEnd = Math.min(friendALeaveMs, friendBLeaveMs);
            const coexistenceTime = Math.max(0, overlapEnd - overlapStart);

            if (coexistenceTime < 30000) return;

            const parsedLoc = parseLocation(row.location);
            const instanceCreatorId = parsedLoc.userId || null;
            const instanceCreatorName = resolveDisplayName(instanceCreatorId);
            const maxPlayerCount = maxPlayerCountMap.value.get(row.location) ?? null;
            const selfPresent = computeSelfPresent(row.location, overlapStart, overlapEnd);
            
            const first = firstMeetingByLocation.get(row.location);
            let initiator = 'mutual';
            if (first) {
                const joinTimeDiffMs = Math.abs(friendAJoin - friendBJoin);
                if (joinTimeDiffMs > THREE_MINUTES) {
                    initiator = friendAJoin > friendBJoin ? 'leftPlayer' : 'rightPlayer';
                } else if (selfPresent) {
                    let isSnapshot = false;
                    const mySessions = selfPresenceMap.value.get(row.location) || [];
                    for (const my of mySessions) {
                        const myJoin = dayjs(my.selfLeave).valueOf() - Math.max(0, my.selfTime);
                        if (Math.abs(friendAJoin - myJoin) <= THREE_MINUTES && Math.abs(friendBJoin - myJoin) <= THREE_MINUTES) {
                            isSnapshot = true;
                            break;
                        }
                    }
                    
                    if (isSnapshot) {
                        initiator = 'unknown';
                    }
                }
            }

            results.push({
                location: row.location,
                friendALeave: friendALeaveMs,
                friendBLeave: friendBLeaveMs,
                coexistenceTime,
                formattedDate: dayjs(Math.min(friendALeaveMs, friendBLeaveMs)).format(dateFormat),
                instanceCreatorName,
                maxPlayerCount,
                selfPresent,
                initiator
            });
        });

        return results.sort((a, b) => Math.max(b.friendALeave, b.friendBLeave) - Math.max(a.friendALeave, a.friendBLeave));
    });

    const totalCoexistenceTime = computed(() => {
        return sharedInstances.value.reduce((acc, item) => acc + item.coexistenceTime, 0);
    });

    async function loadData() {
        if (!selectedFriendAId.value || !selectedFriendBId.value) return;
        isLoading.value = true;
        try {
            const [gamelogResults, feedResults] = await Promise.all([
                database.getCoInstanceHistoryBetweenFriends(
                    selectedFriendAId.value,
                    selectedFriendBId.value
                ),
                database.getCoInstanceHistoryFromFeed(
                    selectedFriendAId.value,
                    selectedFriendBId.value
                )
            ]);

            // Combine and deduplicate roughly by location and leave time
            const combined = [...gamelogResults];
            feedResults.forEach((fr) => {
                const isDuplicate = gamelogResults.some(
                    (gr) =>
                        gr.location === fr.location &&
                        Math.abs(dayjs(gr.friendALeave).valueOf() - dayjs(fr.friendALeave).valueOf()) < 60000
                );
                if (!isDuplicate) {
                    combined.push(fr);
                }
            });

            rawResults.value = combined;

            const locations = [...new Set(combined.map((r) => r.location))];

            const [selfMap, maxMap] = await Promise.all([
                currentUser.value?.id
                    ? database.getSelfPresenceForLocations(currentUser.value.id, locations)
                    : Promise.resolve(new Map()),
                database.getMaxPlayerCountForLocations(locations)
            ]);

            selfPresenceMap.value = selfMap;
            maxPlayerCountMap.value = maxMap;
        } catch (error) {
            console.error('Error loading co-instance history:', error);
            rawResults.value = [];
            selfPresenceMap.value = new Map();
            maxPlayerCountMap.value = new Map();
        } finally {
            isLoading.value = false;
        }
    }

    function handleFriendASelect(friendId) {
        selectedFriendAId.value = friendId || null;
        rawResults.value = [];
        selfPresenceMap.value = new Map();
        maxPlayerCountMap.value = new Map();
        if (friendId && selectedFriendBId.value) {
            loadData();
        }
    }

    function handleFriendBSelect(friendId) {
        selectedFriendBId.value = friendId || null;
        rawResults.value = [];
        selfPresenceMap.value = new Map();
        maxPlayerCountMap.value = new Map();
        if (friendId && selectedFriendAId.value) {
            loadData();
        }
    }

    function swapFriends() {
        const tmp = selectedFriendAId.value;
        selectedFriendAId.value = selectedFriendBId.value;
        selectedFriendBId.value = tmp;
        rawResults.value = [];
        selfPresenceMap.value = new Map();
        maxPlayerCountMap.value = new Map();
        if (selectedFriendAId.value && selectedFriendBId.value) {
            loadData();
        }
    }

    function openInstanceDialog(location) {
        if (location) {
            showWorldDialog(location);
        }
    }

    watch(activeQueryId, () => {
        if (selectedFriendAId.value && selectedFriendBId.value && rawResults.value.length === 0) {
            loadData();
        }
    });

    onMounted(() => {
        if (selectedFriendAId.value && selectedFriendBId.value && rawResults.value.length === 0) {
            loadData();
        }
    });
</script>
