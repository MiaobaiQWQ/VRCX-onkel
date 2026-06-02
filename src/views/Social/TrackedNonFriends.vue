<template>
    <div class="x-container x-container--auto-height flex flex-col gap-3 h-full mb-0 overflow-hidden">
        <!-- Header & Management Section -->
        <div class="flex-none flex flex-col gap-3 bg-card p-4 rounded-xl border shadow-sm shrink-0">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <h1 class="text-xl font-bold tracking-tight">{{ t('side_panel.tracked_nonfriends.tab_label') }}</h1>
                    <div class="flex items-center gap-1 bg-muted/50 px-2 py-1 rounded-full border">
                        <Users class="size-3.5 text-muted-foreground" />
                        <span class="text-xs font-medium">{{ trackedList.length }}</span>
                    </div>
                    <TooltipWrapper :content="t('side_panel.refresh_tooltip')">
                        <Button variant="ghost" size="icon-sm" class="rounded-full h-8 w-8" :disabled="isRefreshing" @click="manualRefresh">
                            <RefreshCw class="size-3.5" :class="{ 'animate-spin': isRefreshing }" />
                        </Button>
                    </TooltipWrapper>
                </div>
                <div class="flex-1 max-w-sm px-4">
                    <div class="relative">
                        <Input
                            v-model="searchQuery"
                            :placeholder="t('view.feed.search_placeholder')"
                            class="h-8 pl-8 text-xs bg-muted/20 border-muted-foreground/20 focus-visible:ring-primary/30"
                        />
                        <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                        <button
                            v-if="searchQuery"
                            class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            @click="searchQuery = ''">
                            <X class="size-3" />
                        </button>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <div class="flex items-center gap-2 bg-muted/30 px-3 py-1.5 rounded-lg border mr-2">
                        <span class="text-xs font-medium text-muted-foreground">{{ t('side_panel.tracked_nonfriends.auto_remove_on_friend_add') }}</span>
                        <Switch v-model="autoRemoveOnFriendAdd" size="sm" class="scale-90" />
                    </div>
                    <Button size="sm" variant="outline" @click="toggleShowGrid">
                        <component :is="showGrid ? List : LayoutGrid" class="mr-2 h-3.5 w-3.5" />
                        {{ showGrid ? t('view.friend_list.table_view') : t('view.friend_list.grid_view') }}
                    </Button>
                    <Button size="sm" @click="openAddDialog">
                        <UserPlus class="mr-2 h-3.5 w-3.5" />
                        {{ t('side_panel.tracked_nonfriends.add_button') }}
                    </Button>
                </div>
            </div>

            <!-- Compact Status Grid (Collapsible or toggleable) -->
            <div
                v-if="showGrid && filteredEnrichedList.length > 0"
                class="max-h-[160px] overflow-y-auto scrollbar-hidden pr-1 animate-in fade-in slide-in-from-top-1 duration-200 shrink-0">
                <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                    <div
                        v-for="entry in filteredEnrichedList"
                        :key="entry.userId"
                        class="relative group cursor-pointer"
                        @click="showUserDialog(entry.userId)">
                        <div
                            class="flex flex-col items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border"
                            :class="{ 'bg-primary/10 border-primary/30': filterUserId === entry.userId }">
                            <div class="relative">
                                <Avatar 
                                    class="size-10 rounded-full border border-background shadow-sm transition-transform group-active:scale-95"
                                    @click.stop="filterUserId = filterUserId === entry.userId ? null : entry.userId">
                                    <AvatarImage :src="userImage(entry.ref)" class="object-cover" />
                                    <AvatarFallback><UserIcon class="size-5 text-muted-foreground" /></AvatarFallback>
                                </Avatar>
                                <div
                                    v-if="entry.ref"
                                    class="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-background shadow-sm"
                                    :class="statusBadgeColor(entry.ref)"></div>
                            </div>
                            <span
                                class="text-[11px] font-medium truncate w-full text-center px-1 cursor-pointer hover:underline"
                                :style="entry.ref ? { color: entry.ref.$userColour } : undefined"
                                @click="showUserDialog(entry.userId)">
                                <template v-if="(entry.ref?.displayName || entry.displayName) && (entry.ref?.displayName || entry.displayName) !== entry.userId">
                                    {{ entry.ref?.displayName || entry.displayName }}
                                </template>
                                <template v-else>
                                    <span class="text-muted-foreground italic scale-90 inline-block">{{ entry.userId }}</span>
                                </template>
                            </span>
                        </div>
                        <Button
                            size="icon"
                            variant="destructive"
                            class="absolute -top-1 -right-1 size-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                            @click.stop="confirmRemove(entry)">
                            <X class="size-3" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>

        <!-- User List Table Section (When grid is off) -->
        <div v-if="!showGrid" class="flex-1 min-h-[300px] flex flex-col bg-card rounded-xl border shadow-sm overflow-hidden">
            <div class="p-3 border-b bg-muted/20 flex items-center justify-between">
                <span class="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                    <List class="size-4" />
                    {{ t('view.friend_list.table_view') }}
                </span>
            </div>
            
            <DataTableLayout
                :table="userTable"
                auto-height
                :total-items="filteredEnrichedList.length"
                class="flex-1">
            </DataTableLayout>
        </div>

        <!-- Feed Section (Matches Friend Feed style) -->
        <div v-if="showGrid" class="flex-1 min-h-[200px] flex flex-col bg-card rounded-xl border shadow-sm overflow-hidden">
            <div class="flex items-center justify-between px-4 py-3 border-b bg-muted/20">
                <span class="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                    <Activity class="size-4" />
                    {{ t('view.tools.other.tracked_nonfriends') }} {{ t('nav_tooltip.feed') }}
                    <Badge v-if="filterUserId" variant="secondary" class="ml-2 py-0 h-5 flex items-center gap-1 animate-in fade-in zoom-in duration-200">
                        <span class="max-w-[100px] truncate">{{ trackedList.find(u => u.userId === filterUserId)?.displayName || filterUserId }}</span>
                        <button class="hover:text-foreground" @click="filterUserId = null"><X class="size-3" /></button>
                    </Badge>
                </span>
                <div class="flex items-center gap-2">
                    <TooltipWrapper :content="t('side_panel.refresh_tooltip')">
                        <Button variant="ghost" size="icon-sm" class="rounded-full h-8 w-8" :disabled="isLoadingFeed" @click="loadFeed">
                            <RefreshCw class="size-3.5" :class="{ 'animate-spin': isLoadingFeed }" />
                        </Button>
                    </TooltipWrapper>
                    <div class="flex items-center gap-1.5 bg-background/50 px-2 py-1 rounded-md border mr-2">
                        <span class="text-[11px] font-medium text-muted-foreground">{{ t('view.tools.other.tracked_nonfriends') }} {{ t('view.feed.filters.Bio') }}</span>
                        <Switch :model-value="showEnhancedBio" @update:model-value="setShowEnhancedBio" size="sm" class="scale-75" />
                    </div>
                    <ToggleGroup type="multiple" variant="outline" size="sm" v-model="feedFilters" class="scale-90 origin-right">
                        <ToggleGroupItem v-for="type in ['Status', 'Bio']" :key="type" :value="type" class="px-2 h-7 text-[11px]">
                            {{ t(`view.feed.filters.${type}`) }}
                        </ToggleGroupItem>
                    </ToggleGroup>
                </div>
            </div>
            
            <DataTableLayout
                v-if="filteredFeedData.length"
                :table="table"
                :loading="isLoadingFeed"
                auto-height
                :total-items="filteredFeedData.length"
                class="flex-1">
            </DataTableLayout>
            
            <div v-else-if="!isLoadingFeed" class="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Activity class="size-12 mb-4 opacity-10" />
                <p class="text-sm font-medium">{{ t('dashboard.widget.no_data') }}</p>
            </div>
            <div v-else class="flex items-center justify-center py-20">
                <Spinner class="size-8" />
            </div>
        </div>

        <!-- Delete Confirmation Dialog -->
        <Dialog v-model:open="deleteConfirmOpen">
            <DialogContent class="w-[360px] max-w-[95vw]">
                <DialogHeader>
                    <DialogTitle>{{ t('common.actions.confirm') }}</DialogTitle>
                    <DialogDescription>
                        {{ t('side_panel.tracked_nonfriends.remove_confirm_message', { name: userToDelete?.displayName || userToDelete?.userId }) || `确定要停止追踪 ${userToDelete?.displayName || userToDelete?.userId} 吗？` }}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" @click="deleteConfirmOpen = false">{{ t('common.actions.cancel') }}</Button>
                    <Button variant="destructive" @click="doRemove">{{ t('common.actions.confirm') }}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <!-- Add Dialog -->
        <Dialog v-model:open="addDialogOpen">
            <DialogContent class="w-[360px] max-w-[95vw]" @open-auto-focus.prevent>
                <DialogHeader>
                    <DialogTitle>{{ t('side_panel.tracked_nonfriends.add_dialog_title') }}</DialogTitle>
                    <DialogDescription>{{ t('side_panel.tracked_nonfriends.add_dialog_hint') }}</DialogDescription>
                </DialogHeader>

                <template v-if="addStep === 'input'">
                    <div class="flex flex-col gap-3 py-2">
                        <Input
                            v-model="addInput"
                            :placeholder="t('side_panel.tracked_nonfriends.add_input_placeholder')"
                            :disabled="isVerifying"
                            @keydown.enter="verifyUser" />
                        <p v-if="addError" class="text-sm text-destructive">{{ addError }}</p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" @click="closeAddDialog">{{ t('common.actions.cancel') }}</Button>
                        <Button :disabled="!addInput.trim() || isVerifying" @click="verifyUser">
                            <Spinner v-if="isVerifying" class="mr-2" />
                            {{ t('common.actions.confirm') }}
                        </Button>
                    </DialogFooter>
                </template>

                <template v-else-if="addStep === 'confirm'">
                    <div class="flex items-center gap-3 py-2">
                        <Avatar class="size-12 rounded-full flex-none">
                            <AvatarImage v-if="verifiedUser" :src="userImage(verifiedUser)" class="object-cover" />
                            <AvatarFallback><UserIcon class="size-5" /></AvatarFallback>
                        </Avatar>
                        <div>
                            <p class="font-medium">{{ t('side_panel.tracked_nonfriends.add_confirm_question', { name: verifiedUser?.displayName || addInput }) }}</p>
                            <p class="text-xs text-muted-foreground">{{ addInput }}</p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" @click="addStep = 'input'">{{ t('side_panel.tracked_nonfriends.add_back') }}</Button>
                        <Button @click="confirmAdd">{{ t('common.actions.confirm') }}</Button>
                    </DialogFooter>
                </template>
            </DialogContent>
        </Dialog>
    </div>
</template>

<script setup>
    import { computed, h, onMounted, onBeforeUnmount, ref, watch, shallowRef } from 'vue';
    import { useLocalStorage } from '@vueuse/core';
    import { storeToRefs } from 'pinia';
    import { useI18n } from 'vue-i18n';
    import {
        Users,
        UserPlus,
        MapPin,
        X,
        User as UserIcon,
        Circle,
        RefreshCw,
        Activity,
        LayoutGrid,
        List,
        Search,
        Pencil,
        Box,
        ArrowRight,
        ArrowDown,
        ChevronDown,
        ChevronRight
    } from 'lucide-vue-next';

    import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
    import { Button } from '@/components/ui/button';
    import { Card, CardContent } from '@/components/ui/card';
    import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
    import { Input } from '@/components/ui/input';
    import { Spinner } from '@/components/ui/spinner';
    import { TooltipWrapper } from '@/components/ui/tooltip';
    import { Badge } from '@/components/ui/badge';
    import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
    import { DataTableLayout } from '@/components/ui/data-table';
    import { Switch } from '@/components/ui/switch';

    import {
        useTrackedNonFriendsStore
    } from '../../stores/trackedNonFriends';
    import {
        useUserStore,
        useAppearanceSettingsStore,
        useChartsStore,
        useGalleryStore,
        useFriendStore
    } from '../../stores';
    import { useUserDisplay } from '../../composables/useUserDisplay';
    import { showUserDialog } from '../../coordinators/userCoordinator';
    import { userRequest } from '../../api';
    import { refreshTrackedNonFriendsFlow, isRunning as isCoordinatorRunning } from '../../coordinators/nonFriendCoordinator';
    import { database } from '../../services/database';
    import { useVrcxVueTable } from '../../lib/table/useVrcxVueTable';
    import { formatDateFilter, statusClass } from '../../shared/utils';
    import Location from '../../components/Location.vue';
    import UserContextMenu from '../../components/UserContextMenu.vue';

    const { t } = useI18n();
    const { userImage } = useUserDisplay();

    const trackedStore = useTrackedNonFriendsStore();
    const { trackedList, autoRemoveOnFriendAdd, changeCounts } = storeToRefs(trackedStore);

    const userStore = useUserStore();
    const friendStore = useFriendStore();
    const chartsStore = useChartsStore();
    const appearanceSettingsStore = useAppearanceSettingsStore();
    const { showEnhancedBio } = storeToRefs(appearanceSettingsStore);
    const { setShowEnhancedBio } = appearanceSettingsStore;

    const enrichedList = computed(() =>
        trackedList.value.map((entry) => {
            const counts = changeCounts.value.get(entry.userId);
            return {
                ...entry,
                ref: userStore.cachedUsers.get(entry.userId) || null,
                totalChanges: counts ? (counts.nameChanges + counts.bioChanges) : 0,
                nameChanges: counts?.nameChanges || 0,
                bioChanges: counts?.bioChanges || 0
            };
        })
    );

    // Automatically fetch missing display names
    watch(enrichedList, (list) => {
        const missingNames = list.filter(e => !e.displayName && !e.ref);
        if (missingNames.length > 0 && !isRefreshing.value) {
            // Background refresh only for missing names
            void refreshTrackedNonFriendsFlow();
        }
    });

    const showGrid = useLocalStorage('vrcx-tracked-non-friends-show-grid', true);
    function toggleShowGrid() {
        showGrid.value = !showGrid.value;
    }

    const deleteConfirmOpen = ref(false);
    const userToDelete = ref(null);

    const searchQuery = ref('');
    const filterUserId = ref(null);

    const filteredEnrichedList = computed(() => {
        const query = searchQuery.value.trim().toLowerCase();
        if (!query) return enrichedList.value;
        return enrichedList.value.filter((entry) => {
            const displayName = entry.ref?.displayName || entry.displayName || '';
            const userId = entry.userId || '';
            return displayName.toLowerCase().includes(query) || userId.toLowerCase().includes(query);
        });
    });

    function confirmRemove(entry) {
        userToDelete.value = entry;
        deleteConfirmOpen.value = true;
    }

    async function doRemove() {
        if (userToDelete.value) {
            const userId = userToDelete.value.userId;
            await trackedStore.removeTrackedNonFriend(userId);
            deleteConfirmOpen.value = false;
            userToDelete.value = null;
        }
    }

    // User Table Definition
    const userColumns = [
        {
            id: 'avatar',
            header: () => '',
            size: 50,
            cell: ({ row }) => {
                const entry = row.original;
                const isFiltered = filterUserId.value === entry.userId;
                return h(Avatar, { 
                    class: [
                        'size-8 rounded-full cursor-pointer transition-all hover:ring-2 hover:ring-primary/50',
                        isFiltered ? 'ring-2 ring-primary bg-primary/10' : ''
                    ], 
                    onClick: () => filterUserId.value = isFiltered ? null : entry.userId 
                }, () => [
                    h(AvatarImage, { src: userImage(entry.ref), class: 'object-cover' }),
                    h(AvatarFallback, () => h(UserIcon, { class: 'size-4 text-muted-foreground' }))
                ]);
            }
        },
        {
            accessorKey: 'displayName',
            header: () => t('table.feed.user'),
            size: 200,
            enableSorting: true,
            cell: ({ row }) => {
                const entry = row.original;
                const displayName = entry.ref?.displayName || entry.displayName || entry.userId;
                return h(UserContextMenu, { userId: entry.userId, state: entry.ref?.state || '', location: entry.ref?.location || '' }, () =>
                    h('span', { 
                        class: 'cursor-pointer font-semibold hover:underline',
                        style: entry.ref?.$userColour ? { color: entry.ref.$userColour } : {},
                        onClick: () => showUserDialog(entry.userId)
                    }, displayName === entry.userId ? h('span', { class: 'text-muted-foreground italic' }, entry.userId) : displayName)
                );
            }
        },
        {
            id: 'status',
            header: () => t('view.feed.filters.Status'),
            size: 150,
            cell: ({ row }) => {
                const entry = row.original;
                if (!entry.ref) return null;
                return h('div', { class: 'flex items-center gap-2 text-xs' }, [
                    h('i', { class: ['x-user-status', statusClass(entry.ref.status)] }),
                    h('span', { class: 'text-muted-foreground truncate' }, entry.ref.statusDescription)
                ]);
            }
        },
        {
            id: 'changes',
            accessorKey: 'totalChanges',
            header: () => '改了几次',
            size: 120,
            enableSorting: true,
            sortingFn: 'basic',
            cell: ({ row }) => {
                const entry = row.original;
                return h('div', { class: 'flex flex-col gap-0.5 text-[10px]' }, [
                    h('span', `名字: ${entry.nameChanges}`),
                    h('span', `简介: ${entry.bioChanges}`)
                ]);
            }
        },
        {
            id: 'addedLocation',
            accessorKey: 'location',
            header: () => '追踪地点',
            size: 180,
            enableSorting: true,
            cell: ({ row }) => {
                const entry = row.original;
                const location = typeof entry.location === 'string' ? entry.location : '';
                if (!location || location === '[object Object]' || location.includes('[object Object]')) {
                    return h('span', { class: 'text-xs text-muted-foreground italic' }, t('common.unknown'));
                }
                return h(Location, {
                    location: location,
                    enableContextMenu: true,
                    disableTooltip: true,
                    class: 'truncate text-xs'
                });
            }
        },
        {
            id: 'bio',
            header: () => t('view.feed.filters.Bio'),
            cell: ({ row }) => {
                const entry = row.original;
                if (!entry.ref) return null;
                return h('span', { class: 'block w-full truncate text-xs text-muted-foreground', title: entry.ref.bio }, entry.ref.bio);
            }
        },
        {
            id: 'addedAt',
            accessorKey: 'addedAt',
            header: () => '追踪时间',
            size: 150,
            enableSorting: true,
            cell: ({ row }) => {
                return h('span', { class: 'text-xs text-muted-foreground' }, formatDateFilter(row.original.addedAt));
            }
        },
        {
            id: 'actions',
            header: () => '',
            size: 50,
            cell: ({ row }) => {
                const entry = row.original;
                return h(Button, {
                    variant: 'ghost',
                    size: 'icon-sm',
                    class: 'rounded-full h-8 w-8 text-destructive hover:bg-destructive/10',
                    onClick: (e) => {
                        e.stopPropagation();
                        confirmRemove(entry);
                    }
                }, () => h(X, { class: 'size-4' }));
            }
        }
    ];

    onMounted(() => {
        loadFeed();
    });

    const { table: userTable } = useVrcxVueTable({
        get data() { return filteredEnrichedList.value; },
        columns: userColumns,
        getRowId: (row) => row.userId,
        initialPagination: { pageSize: 50 },
        enableSorting: true,
        tableOptions: {
            autoResetPageIndex: false
        }
    });

    const isRefreshing = ref(false);
    async function manualRefresh() {
        if (isRefreshing.value || isCoordinatorRunning) {
            toast.info('正在刷新中，请稍候...');
            return;
        }
        isRefreshing.value = true;
        try {
            await refreshTrackedNonFriendsFlow();
            await trackedStore.loadTrackedNonFriends();
            if (showGrid.value) {
                await loadFeed();
            }
            toast.success('非好友数据刷新完成');
        } catch (err) {
            console.error('Refresh failed', err);
            toast.error('刷新失败，请稍后重试');
        } finally {
            isRefreshing.value = false;
        }
    }

    // Feed Logic
    const feedData = shallowRef([]);
    const filteredFeedData = computed(() => {
        let data = feedData.value;
        const query = searchQuery.value.trim().toLowerCase();
        
        if (filterUserId.value) {
            data = data.filter(row => row.userId === filterUserId.value);
        }

        if (!query) return data;
        
        return data.filter((row) => {
            const displayName = row.displayName || '';
            const userId = row.userId || '';
            return displayName.toLowerCase().includes(query) || userId.toLowerCase().includes(query);
        });
    });
    const isLoadingFeed = ref(false);
    const feedFilters = useLocalStorage('vrcx-tracked-non-friends-feed-filters', ['Status', 'Bio']);

    async function loadFeed() {
        if (trackedList.value.length === 0 || !showGrid.value) {
            feedData.value = [];
            return;
        }
        isLoadingFeed.value = true;
        try {
            const vipList = trackedList.value.map(t => t.userId);
            const rows = await database.lookupFeedDatabase(feedFilters.value, vipList);
            
            feedData.value = rows.filter(row => {
                const isFriend = friendStore.friends.has(row.userId);
                if (!isFriend) {
                    return row.type === 'Status' || row.type === 'Bio';
                }
                return true;
            });
        } catch (err) {
            console.error('Failed to load tracked feed', err);
        } finally {
            isLoadingFeed.value = false;
        }
    }

    watch(feedFilters, () => loadFeed());
    watch(trackedList, () => loadFeed(), { deep: true });
    watch(showGrid, (val) => {
        if (val) loadFeed();
    });

    // Table Definition (Matches Feed.vue)
    const columns = [
        {
            id: 'expander',
            header: () => null,
            size: 40,
            cell: ({ row }) => {
                return h(Button, {
                    variant: 'ghost',
                    size: 'icon-xs',
                    onClick: (e) => {
                        e.stopPropagation();
                        row.toggleExpanded();
                    }
                }, () => row.getIsExpanded() ? h(ChevronDown, { class: 'size-4' }) : h(ChevronRight, { class: 'size-4' }));
            }
        },
        {
            accessorKey: 'created_at',
            header: () => t('table.feed.date'),
            size: 140,
            cell: ({ row }) => {
                const date = row.getValue('created_at');
                return h(TooltipWrapper, { content: formatDateFilter(date, 'long'), side: 'right' }, () => 
                    h('span', { class: 'text-xs tabular-nums text-muted-foreground' }, formatDateFilter(date, 'short'))
                );
            }
        },
        {
            accessorKey: 'type',
            header: () => t('table.feed.type'),
            size: 100,
            cell: ({ row }) => h(Badge, { variant: 'outline', class: 'text-[10px] uppercase font-bold tracking-wider' }, () => t(`view.feed.filters.${row.getValue('type')}`))
        },
        {
            accessorKey: 'displayName',
            header: () => t('table.feed.user'),
            size: 180,
            cell: ({ row }) => {
                const userId = row.original.userId;
                const displayName = row.getValue('displayName');
                const cached = userStore.cachedUsers.get(userId);
                return h(UserContextMenu, { userId, state: cached?.state || '', location: cached?.location || '' }, () =>
                    h('span', { 
                        class: 'cursor-pointer font-semibold hover:underline',
                        style: cached?.$userColour ? { color: cached.$userColour } : {},
                        onClick: () => showUserDialog(userId)
                    }, displayName)
                );
            }
        },
        {
            id: 'detail',
            header: () => t('table.feed.detail'),
            meta: {
                expandedRow: ({ row }) => {
                    const item = row.original;
                    if (item.type === 'Bio') {
                        return h('div', { class: 'pl-10 py-2 text-sm' }, [
                            h('pre', { 
                                class: 'whitespace-pre-wrap font-[inherit] leading-relaxed',
                                innerHTML: formatDifference(
                                    item.previousBio, 
                                    item.bio,
                                    '<span class="x-text-added">{{text}}</span>',
                                    '<span class="x-text-removed">{{text}}</span>',
                                    '<span class="x-text-normal">{{text}}</span>'
                                )
                            })
                        ]);
                    }
                    if (item.type === 'Status') {
                        return h('div', { class: 'pl-10 py-2 flex items-center gap-2 text-sm' }, [
                            h('i', { class: ['x-user-status', statusClass(item.previousStatus)] }),
                            item.previousStatusDescription ? h('span', item.previousStatusDescription) : null,
                            h(ArrowRight, { class: 'size-3 mx-1' }),
                            h('i', { class: ['x-user-status', statusClass(item.status)] }),
                            h('span', item.statusDescription)
                        ]);
                    }
                    if (item.type === 'GPS' && item.previousLocation) {
                        return h('div', { class: 'pl-10 py-2 flex flex-col gap-2' }, [
                            h('div', { class: 'flex items-center gap-2' }, [
                                h(Badge, { variant: 'secondary' }, 'From'),
                                h(Location, { location: item.previousLocation, enableContextMenu: true })
                            ]),
                            h(ArrowDown, { class: 'size-4 ml-4' }),
                            h('div', { class: 'flex items-center gap-2' }, [
                                h(Badge, { variant: 'secondary' }, 'To'),
                                h(Location, { location: item.location, hint: item.worldName, grouphint: item.groupName, enableContextMenu: true })
                            ])
                        ]);
                    }
                    return null;
                }
            },
            cell: ({ row }) => {
                const item = row.original;
                if (item.type === 'GPS' || item.type === 'Online' || item.type === 'Offline') {
                    if (!item.location) return null;
                    return h('div', { class: 'flex items-center gap-1.5 min-w-0' }, [
                        item.type === 'GPS' ? h(MapPin, { class: 'size-3.5 text-muted-foreground shrink-0' }) : null,
                        h(Location, {
                            location: item.location,
                            hint: item.worldName,
                            grouphint: item.groupName,
                            enableContextMenu: true,
                            disableTooltip: true,
                            class: 'truncate text-sm'
                        })
                    ]);
                }
                if (item.type === 'Status') {
                    return h('div', { class: 'flex items-center gap-2 text-sm' }, [
                        h('i', { class: ['x-user-status', statusClass(item.status)] }),
                        h('span', { class: 'text-muted-foreground truncate' }, item.statusDescription)
                    ]);
                }
                if (item.type === 'Bio') {
                    if (showEnhancedBio.value) {
                        return h('div', { 
                            class: 'block w-full truncate text-sm leading-relaxed',
                            innerHTML: formatDifference(
                                item.previousBio, 
                                item.bio,
                                '<span class="x-text-added">{{text}}</span>', // Yellow (Added)
                                '<span class="x-text-removed">{{text}}</span>', // Red (Removed/Changed)
                                '<span class="x-text-normal">{{text}}</span>' // Green (No change)
                            )
                        });
                    }
                    return h('span', { class: 'block w-full truncate text-sm text-muted-foreground' }, item.bio);
                }
                return null;
            }
        }
    ];

    const { table } = useVrcxVueTable({
        get data() { return filteredFeedData.value; },
        columns,
        getRowId: (row) => `${row.type}:${row.created_at}:${row.userId}`,
        enableExpanded: true,
        getRowCanExpand: () => true,
        initialPagination: { pageSize: 50 }
    });

    function formatDifference(
        oldString,
        newString,
        markerAddition = '<span class="x-text-added">{{text}}</span>',
        markerDeletion = '<span class="x-text-removed">{{text}}</span>',
        markerNormal = '<span class="x-text-normal">{{text}}</span>'
    ) {
        [oldString, newString] = [oldString, newString].map((s) =>
            String(s ?? '')
                .replaceAll(/&/g, '&amp;')
                .replaceAll(/</g, '&lt;')
                .replaceAll(/>/g, '&gt;')
                .replaceAll(/"/g, '&quot;')
                .replaceAll(/'/g, '&#039;')
                .replaceAll(/\n/g, '<br>')
        );

        const oldWords = oldString
            .split(/\s+/)
            .flatMap((word) => word.split(/(<br>)/));
        const newWords = newString
            .split(/\s+/)
            .flatMap((word) => word.split(/(<br>)/));

        function findLongestMatch(oldStart, oldEnd, newStart, newEnd) {
            let bestOldStart = oldStart;
            let bestNewStart = newStart;
            let bestSize = 0;

            const lookup = new Map();
            for (let i = oldStart; i < oldEnd; i++) {
                const word = oldWords[i];
                if (!lookup.has(word)) lookup.set(word, []);
                lookup.get(word).push(i);
            }

            for (let j = newStart; j < newEnd; j++) {
                const word = newWords[j];
                if (!lookup.has(word)) continue;

                for (const i of lookup.get(word)) {
                    let size = 0;
                    while (
                        i + size < oldEnd &&
                        j + size < newEnd &&
                        oldWords[i + size] === newWords[j + size]
                    ) {
                        size++;
                    }
                    if (size > bestSize) {
                        bestOldStart = i;
                        bestNewStart = j;
                        bestSize = size;
                    }
                }
            }

            return {
                oldStart: bestOldStart,
                newStart: bestNewStart,
                size: bestSize
            };
        }

        function buildDiff(oldStart, oldEnd, newStart, newEnd) {
            const result = [];
            const match = findLongestMatch(oldStart, oldEnd, newStart, newEnd);

            if (match.size > 0) {
                if (oldStart < match.oldStart || newStart < match.newStart) {
                    result.push(
                        ...buildDiff(
                            oldStart,
                            match.oldStart,
                            newStart,
                            match.newStart
                        )
                    );
                }

                // Normal (Common) text -> markerNormal
                function buildNormal(words, start, end) {
                    let r = [];
                    let ts = words
                        .slice(start, end)
                        .filter((w) => w.length > 0)
                        .join(' ')
                        .split('<br>');
                    for (let i = 0; i < ts.length; i++) {
                        if (i > 0) r.push('<br>');
                        if (ts[i].length < 1) continue;
                        r.push(markerNormal.replace('{{text}}', ts[i]));
                    }
                    return r;
                }
                result.push(...buildNormal(oldWords, match.oldStart, match.oldStart + match.size));

                if (
                    match.oldStart + match.size < oldEnd ||
                    match.newStart + match.size < newEnd
                ) {
                    result.push(
                        ...buildDiff(
                            match.oldStart + match.size,
                            oldEnd,
                            match.newStart + match.size,
                            newEnd
                        )
                    );
                }
            } else {
                function build(words, start, end, pattern) {
                    let r = [];
                    let ts = words
                        .slice(start, end)
                        .filter((w) => w.length > 0)
                        .join(' ')
                        .split('<br>');
                    for (let i = 0; i < ts.length; i++) {
                        if (i > 0) r.push('<br>');
                        if (ts[i].length < 1) continue;
                        r.push(pattern.replace('{{text}}', ts[i]));
                    }
                    return r;
                }

                if (oldStart < oldEnd)
                    result.push(
                        ...build(oldWords, oldStart, oldEnd, markerDeletion)
                    );

                if (newStart < newEnd)
                    result.push(
                        ...build(newWords, newStart, newEnd, markerAddition)
                    );
            }

            return result;
        }

        return buildDiff(0, oldWords.length, 0, newWords.length)
            .join(' ')
            .replace(/<br>[ ]+<br>/g, '<br><br>')
            .replace(/<br> /g, '<br>');
    }

    onMounted(() => {
        loadFeed();
        manualRefresh();
    });

    onBeforeUnmount(() => {
        changeCounts.value.clear();
        feedData.value = [];
    });

    function statusBadgeColor(ref) {
        if (!ref) return 'bg-muted-foreground';
        switch (ref.status) {
            case 'active': return 'bg-green-500';
            case 'online': return 'bg-blue-500';
            case 'busy': return 'bg-red-500';
            case 'ask me': return 'bg-yellow-500';
            case 'join me': return 'bg-cyan-500';
            default: return 'bg-muted-foreground/50';
        }
    }

    async function removeEntry(userId) {
        await trackedStore.removeTrackedNonFriend(userId);
    }

    const addDialogOpen = ref(false);
    const addStep = ref('input');
    const addInput = ref('');
    const addError = ref('');
    const isVerifying = ref(false);
    const verifiedUser = ref(null);

    function openAddDialog() {
        addInput.value = '';
        addError.value = '';
        addStep.value = 'input';
        verifiedUser.value = null;
        addDialogOpen.value = true;
    }

    function closeAddDialog() { addDialogOpen.value = false; }

    async function verifyUser() {
        const userId = addInput.value.trim();
        if (!userId) return;
        addError.value = '';
        isVerifying.value = true;
        try {
            const result = await userRequest.getUser({ userId });
            const userData = result?.ref;
            if (!userData) throw new Error('no_data');
            verifiedUser.value = userData;
            addStep.value = 'confirm';
        } catch (err) {
            addError.value = t('side_panel.tracked_nonfriends.add_verify_error');
        } finally {
            isVerifying.value = false;
        }
    }

    async function confirmAdd() {
        const user = verifiedUser.value;
        if (!user) return;
        await trackedStore.addTrackedNonFriend(user.id, user.displayName, '', user.bio || '');
        closeAddDialog();
        try {
            await chartsStore.fetchSingleFriendMutuals(user.id);
            await manualRefresh();
        } catch (err) {
            console.error('[TrackedNonFriends] Failed to automatically fetch mutuals', err);
        }
    }
</script>

<style scoped>
    .x-container--auto-height {
        height: 100% !important;
        margin-bottom: 0 !important;
        display: flex;
        flex-direction: column;
    }

    :deep(.x-text-removed) {
        text-decoration: line-through;
        color: #ef4444; /* Red */
        background-color: rgba(239, 68, 68, 0.1);
        padding: 0 2px;
        border-radius: 2px;
    }

    :deep(.x-text-added) {
        color: #eab308; /* Yellow */
        background-color: rgba(234, 179, 8, 0.1);
        padding: 0 2px;
        border-radius: 2px;
    }

    :deep(.x-text-normal) {
        color: #22c55e; /* Green */
    }
</style>
