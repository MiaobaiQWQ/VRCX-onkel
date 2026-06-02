<template>
    <div class="screenshot-metadata-page x-container flex flex-col overflow-hidden">
        <div class="flex items-center gap-2 ml-2">
            <Button variant="ghost" size="sm" class="mr-3" @click="goBack">
                <ArrowLeft />
                {{ t('nav_tooltip.tools') }}
            </Button>
            <span class="header">{{ t('dialog.screenshot_metadata.header') }}</span>
        </div>

        <div class="flex items-center gap-2 my-2 flex-wrap">
            <Button size="sm" variant="outline" @click="getAndDisplayScreenshotFromFile">
                <FolderSearch />
                {{ t('dialog.screenshot_metadata.browse') }}
            </Button>
            <Button
                v-if="searchViewMode === 'detail'"
                size="sm"
                variant="outline"
                @click="returnToAllImages">
                <ArrowLeft />
                {{ t('dialog.screenshot_metadata.return_to_all_images', '返回所有图片') }}
            </Button>
            <Button
                v-if="screenshotMetadataDialog.metadata.filePath"
                size="sm"
                variant="outline"
                @click="openImageFolder(screenshotMetadataDialog.metadata.filePath)">
                <FolderOpen />
                {{ t('dialog.screenshot_metadata.open_folder') }}
            </Button>
            <div class="flex-1" />
            <InputGroupSearch
                v-model="screenshotMetadataDialog.search"
                :placeholder="t('dialog.screenshot_metadata.search_placeholder')"
                style="width: 200px"
                @input="screenshotMetadataSearch" />
            <Select :model-value="screenshotMetadataDialog.searchType" @update:modelValue="handleSearchTypeChange">
                <SelectTrigger size="sm" style="width: 150px">
                    <SelectValue :placeholder="t('dialog.screenshot_metadata.search_type_placeholder')" />
                </SelectTrigger>
                <SelectContent>
                    <SelectGroup>
                        <SelectItem v-for="type in screenshotMetadataDialog.searchTypes" :key="type" :value="type">
                            {{ t(screenshotMetadataSearchTypeLabels[type] ?? type) }}
                        </SelectItem>
                    </SelectGroup>
                </SelectContent>
            </Select>
            <span v-if="searchViewMode === 'grid' && searchResultsData.length" class="whitespace-pre-wrap text-xs">{{
                t('dialog.screenshot_metadata.result_count', { count: searchResultsData.length })
            }}</span>
            <span v-else-if="screenshotMetadataDialog.searchIndex !== null" class="whitespace-pre-wrap text-xs">{{
                screenshotMetadataDialog.searchIndex + 1 + '/' + screenshotMetadataDialog.searchResults.length
            }}</span>
        </div>

        <!-- Search Results Grid View -->
        <div v-if="searchViewMode === 'grid'" class="flex-1 min-h-0 flex gap-2 overflow-hidden p-2">
            <div ref="gridContainerRef" class="flex-1 min-h-0 overflow-auto">
                <div :style="virtualContainerStyle" class="relative w-full">
                    <div
                        v-for="virtualRow in virtualItems"
                        :key="virtualRow.index"
                        class="absolute left-0 top-0 w-full"
                        :style="{
                            transform: `translateY(${virtualRow.start}px)`,
                            height: `${virtualRow.size - 16}px`
                        }">
                        <div
                            class="grid gap-4"
                            :style="{
                                gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`
                            }">
                            <div
                                v-for="(row, idx) in virtualRow.row.items"
                                :key="row.filePath"
                                class="group relative aspect-[4/3] rounded-lg overflow-hidden border bg-muted cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                                :class="row.filePath === selectedSearchFilePath ? 'ring-2 ring-primary' : ''"
                                @click="selectSearchResult(virtualRow.row.startIndex + idx)">
                                <img
                                    :src="getFileUrl(row.filePath)"
                                    class="w-full h-full object-cover"
                                    loading="lazy" />
                                <div class="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                                    <div class="text-white text-xs truncate drop-shadow-md font-medium">
                                        {{ row.dateFormatted }}
                                    </div>
                                    <div class="text-white/80 text-[10px] truncate drop-shadow-md">
                                        {{ row.world || '—' }}
                                    </div>
                                    <div v-if="row.match" class="text-primary text-[10px] truncate drop-shadow-md">
                                        {{ row.match }}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div v-if="timelineGroups.length > 0" class="w-24 shrink-0 overflow-y-auto border-l pl-2 text-xs flex flex-col gap-1">
                <div
                    v-for="group in timelineGroups"
                    :key="group.label"
                    class="cursor-pointer hover:text-primary transition-colors py-1 truncate"
                    @click="scrollToGroup(group.index)">
                    {{ group.label }}
                </div>
            </div>
        </div>

        <!-- Detail View -->
        <div v-else class="grid flex-1 min-h-0 overflow-hidden gap-4" style="grid-template-columns: 1fr 380px">
            <div class="flex flex-col items-center min-h-0" @dragover.prevent @dragenter.prevent @drop="handleDrop">
                <div class="relative flex-1 w-full min-h-0 flex items-center justify-center">
                    <template v-if="screenshotMetadataDialog.metadata.filePath">
                        <img
                            class="cursor-pointer max-w-full max-h-full object-contain"
                            :src="getFileUrl(screenshotMetadataDialog.metadata.filePath)"
                            @click="showFullscreenImageDialog(getFileUrl(screenshotMetadataDialog.metadata.filePath))" />
                        <Button
                            variant="ghost"
                            size="icon"
                            class="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 hover:opacity-100 transition-opacity bg-background/50 rounded-full"
                            @click="navigatePrev">
                            <ChevronLeft />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            class="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 hover:opacity-100 transition-opacity bg-background/50 rounded-full"
                            @click="navigateNext">
                            <ChevronRight />
                        </Button>
                    </template>
                    <span v-else class="text-muted-foreground text-sm">{{ t('dialog.screenshot_metadata.drag') }}</span>
                </div>
                <div class="shrink-0 flex items-center justify-center h-[50px]">
                    <ButtonGroup class="shadow-lg rounded-lg">
                        <Button variant="outline" size="sm" @click="navigatePrev">
                            <ArrowLeft />
                            <Kbd class="ml-1">{{ isMac ? '⌥' : 'Alt' }}</Kbd>
                            <Kbd>←</Kbd>
                        </Button>
                        <Button variant="outline" size="sm" @click="navigateNext">
                            <Kbd class="ml-1">{{ isMac ? '⌥' : 'Alt' }}</Kbd>
                            <Kbd>→</Kbd>
                            <ArrowRight />
                        </Button>
                    </ButtonGroup>
                </div>
            </div>

            <div class="overflow-y-auto pr-1">
                <Button
                    v-if="searchResultsData.length"
                    variant="ghost"
                    size="sm"
                    class="mb-2"
                    @click="searchViewMode = 'grid'">
                    <ArrowLeft class="size-3.5" />
                    {{ t('dialog.screenshot_metadata.back_to_results', { count: searchResultsData.length }) }}
                </Button>
                <template v-if="screenshotMetadataDialog.metadata.error">
                    <pre class="whitespace-pre-wrap text-xs" v-text="screenshotMetadataDialog.metadata.error"></pre>
                </template>
                <template v-else>
                    <div
                        v-if="screenshotMetadataDialog.metadata.world || screenshotMetadataDialog.metadata.author"
                        class="pb-4">
                        <h4 class="text-[11px] font-medium uppercase tracking-[0.08em] mb-1.5 text-muted-foreground">
                            {{ t('dialog.screenshot_metadata.section_location') }}
                        </h4>
                        <Location
                            v-if="screenshotMetadataDialog.metadata.world"
                            :location="screenshotMetadataDialog.metadata.world.instanceId"
                            :hint="screenshotMetadataDialog.metadata.world.name" />
                        <div
                            v-if="screenshotMetadataDialog.metadata.author"
                            class="flex items-center gap-1 text-muted-foreground">
                            <Camera class="size-3.5 shrink-0" />
                            <DisplayName
                                :userid="screenshotMetadataDialog.metadata.author.id"
                                :hint="screenshotMetadataDialog.metadata.author.displayName" />
                        </div>
                    </div>

                    <div v-if="screenshotMetadataDialog.metadata.players?.length" class="border-t pt-4 pb-4">
                        <h4 class="text-[11px] font-medium uppercase tracking-[0.08em] mb-1.5 text-muted-foreground">
                            {{ t('dialog.screenshot_metadata.section_players') }} ({{
                                screenshotMetadataDialog.metadata.players.length
                            }})
                        </h4>
                        <div class="flex flex-wrap gap-1 max-h-[180px] overflow-y-auto">
                            <Badge
                                v-for="user in screenshotMetadataDialog.metadata.players"
                                :key="user.id"
                                variant="secondary"
                                class="cursor-pointer hover:bg-accent transition-colors"
                                @click="lookupUser(user)">
                                {{ user.displayName }}
                            </Badge>
                        </div>
                    </div>

                    <div class="border-t pt-4 pb-4">
                        <h4 class="text-[11px] font-medium uppercase tracking-[0.08em] mb-1.5 text-muted-foreground">
                            {{ t('dialog.screenshot_metadata.section_file_info') }}
                        </h4>
                        <span v-if="screenshotMetadataDialog.metadata.dateTime" class="text-sm">{{
                            formatDateFilter(screenshotMetadataDialog.metadata.dateTime, 'long')
                        }}</span>
                        <br />
                        <span class="text-xs text-muted-foreground">
                            <span
                                v-if="screenshotMetadataDialog.metadata.fileResolution"
                                v-text="screenshotMetadataDialog.metadata.fileResolution"></span>
                            <span
                                v-if="
                                    screenshotMetadataDialog.metadata.fileResolution &&
                                    screenshotMetadataDialog.metadata.fileSize
                                ">
                                ·
                            </span>
                            <span v-if="screenshotMetadataDialog.metadata.fileSize">{{
                                screenshotMetadataDialog.metadata.fileSize
                            }}</span>
                        </span>
                        <br />
                        <span
                            class="text-xs text-muted-foreground/60"
                            v-text="screenshotMetadataDialog.metadata.fileName"></span>
                    </div>

                    <div v-if="screenshotMetadataDialog.metadata.note" class="border-t pt-4 pb-4">
                        <h4 class="text-[11px] font-medium uppercase tracking-[0.08em] mb-1.5 text-muted-foreground">
                            {{ t('dialog.screenshot_metadata.section_note') }}
                        </h4>
                        <span
                            class="text-sm text-muted-foreground"
                            v-text="screenshotMetadataDialog.metadata.note"></span>
                    </div>

                    <div v-if="screenshotMetadataDialog.metadata.filePath" class="border-t pt-4 pb-4">
                        <h4 class="text-[11px] font-medium uppercase tracking-[0.08em] mb-1.5 text-muted-foreground">
                            {{ t('dialog.screenshot_metadata.section_actions') }}
                        </h4>
                        <div class="flex flex-wrap gap-2">
                            <Button
                                size="sm"
                                variant="outline"
                                @click="copyImageToClipboard(screenshotMetadataDialog.metadata.filePath)">
                                <Copy />
                                {{ t('dialog.screenshot_metadata.copy_image') }}
                            </Button>
                            <Button
                                v-if="isLocalUserVrcPlusSupporter && screenshotMetadataDialog.metadata.filePath"
                                size="sm"
                                variant="outline"
                                @click="uploadScreenshotToGallery">
                                <Upload />
                                {{ t('dialog.screenshot_metadata.upload') }}
                            </Button>
                            <Button
                                v-if="screenshotMetadataDialog.metadata.filePath"
                                size="sm"
                                variant="destructive"
                                @click="deleteMetadata(screenshotMetadataDialog.metadata.filePath)">
                                <Trash2 />
                                {{ t('dialog.screenshot_metadata.delete_metadata') }}
                            </Button>
                        </div>
                    </div>
                </template>
            </div>
        </div>
    </div>
</template>

<script setup>
    import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import { useMagicKeys, whenever, useResizeObserver } from '@vueuse/core';
    import { onMounted, onUnmounted, reactive, ref, computed, nextTick } from 'vue';
    import { useVirtualizer } from '@tanstack/vue-virtual';
    import { useGalleryStore, useUserStore, useVrcxStore } from '@/stores';
    import {
        ArrowLeft,
        ArrowRight,
        Camera,
        ChevronLeft,
        ChevronRight,
        Copy,
        FolderOpen,
        FolderSearch,
        ImageIcon,
        Trash2,
        Upload,
        Users
    } from 'lucide-vue-next';
    import { Badge } from '@/components/ui/badge';
    import { Button } from '@/components/ui/button';
    import { ButtonGroup } from '@/components/ui/button-group';
    import { InputGroupSearch } from '@/components/ui/input-group';
    import { Kbd } from '@/components/ui/kbd';

    import { formatDateFilter } from '@/shared/utils';
    import { storeToRefs } from 'pinia';
    import { toast } from 'vue-sonner';
    import { useI18n } from 'vue-i18n';
    import { useRouter } from 'vue-router';
    import { vrcPlusImageRequest } from '@/api';
    import { lookupUser } from '@/coordinators/userCoordinator';

    const router = useRouter();
    const { t } = useI18n();

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

    const { showFullscreenImageDialog, handleGalleryImageAdd } = useGalleryStore();
    const { currentlyDroppingFile } = storeToRefs(useVrcxStore());
    const { isLocalUserVrcPlusSupporter } = storeToRefs(useUserStore());
    const { fullscreenImageDialog } = storeToRefs(useGalleryStore());

    const screenshotMetadataDialog = reactive({
        loading: false,
        search: '',
        searchType: 'Player Name',
        searchTypes: ['Player Name', 'Player ID', 'World Name', 'World ID'],
        searchIndex: null,
        searchResults: null,
        metadata: {},
        isUploading: false
    });

    const screenshotMetadataSearchTypeLabels = {
        'Player Name': 'dialog.screenshot_metadata.search_types.player_name',
        'Player ID': 'dialog.screenshot_metadata.search_types.player_id',
        'World Name': 'dialog.screenshot_metadata.search_types.world_name',
        'World ID': 'dialog.screenshot_metadata.search_types.world_id'
    };

    const searchViewMode = ref('detail');
    const searchResultsData = ref([]);
    const selectedSearchFilePath = ref(null);
    const searchSort = reactive({ key: 'dateTime', asc: false });

    const gridContainerRef = ref(null);
    const containerWidth = ref(0);

    useResizeObserver(gridContainerRef, (entries) => {
        const [entry] = entries;
        containerWidth.value = Math.max(entry?.contentRect?.width ?? gridContainerRef.value?.clientWidth ?? 0, 0);
    });

    const searchHasMatchColumn = computed(() => {
        const type = screenshotMetadataDialog.searchType;
        return type === 'Player Name' || type === 'Player ID';
    });

    const sortedSearchResults = computed(() => {
        const data = [...searchResultsData.value];
        const { key, asc } = searchSort;
        data.sort((a, b) => {
            let va = a[key];
            let vb = b[key];
            if (typeof va === 'string') va = va.toLowerCase();
            if (typeof vb === 'string') vb = vb.toLowerCase();
            if (va < vb) return asc ? -1 : 1;
            if (va > vb) return asc ? 1 : -1;
            return 0;
        });
        return data;
    });

    function toggleSearchSort(key) {
        if (searchSort.key === key) {
            searchSort.asc = !searchSort.asc;
        } else {
            searchSort.key = key;
            searchSort.asc = key === 'dateTime' ? false : true;
        }
    }

    const gridColumns = computed(() => {
        if (containerWidth.value === 0) return 1;
        // CSS grid was grid-cols-[repeat(auto-fill,minmax(200px,1fr))] with gap-4 (16px)
        const cols = Math.floor((containerWidth.value + 16) / 216);
        return Math.max(1, cols);
    });

    const virtualRows = computed(() => {
        const cols = gridColumns.value;
        const rows = [];
        const data = sortedSearchResults.value;
        for (let i = 0; i < data.length; i += cols) {
            rows.push({
                items: data.slice(i, i + cols),
                startIndex: i
            });
        }
        return rows;
    });

    const timelineGroups = computed(() => {
        if (searchSort.key !== 'dateTime') return [];
        
        const groups = [];
        let currentLabel = '';
        
        virtualRows.value.forEach((row, rowIndex) => {
            const firstItem = row.items[0];
            if (!firstItem || !firstItem.dateTime) return;
            
            const date = new Date(firstItem.dateTime);
            const label = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            
            if (label !== currentLabel) {
                groups.push({ label, index: rowIndex });
                currentLabel = label;
            }
        });
        
        return groups;
    });

    const rowHeight = computed(() => {
        if (containerWidth.value === 0) return 200;
        const cols = gridColumns.value;
        const gap = 16;
        const itemWidth = (containerWidth.value - gap * (cols - 1)) / cols;
        return itemWidth * 0.75 + gap;
    });

    const virtualizer = useVirtualizer(
        computed(() => ({
            count: virtualRows.value.length,
            getScrollElement: () => gridContainerRef.value,
            estimateSize: () => rowHeight.value,
            overscan: 5
        }))
    );

    const virtualItems = computed(() => {
        const items = virtualizer.value?.getVirtualItems?.() ?? [];
        return items.map((virtualItem) => ({
            ...virtualItem,
            row: virtualRows.value[virtualItem.index]
        }));
    });

    const virtualContainerStyle = computed(() => ({
        height: `${virtualizer.value?.getTotalSize?.() ?? 0}px`,
        width: '100%'
    }));

    function scrollToGroup(rowIndex) {
        virtualizer.value?.scrollToIndex?.(rowIndex, { align: 'start' });
    }

    function selectSearchResult(idx) {
        const row = sortedSearchResults.value[idx];
        if (!row) return;
        screenshotMetadataDialog.searchIndex = idx;
        selectedSearchFilePath.value = row.filePath;
        searchViewMode.value = 'detail';
        getAndDisplayScreenshot(row.filePath, false);
    }

    async function loadSearchResultsMetadata(filePaths, query, searchType) {
        const results = [];
        const lowerQuery = String(query).toLowerCase();
        
        // If it's a full gallery load (empty query), skip deep metadata parsing to prevent freezing
        if (query === '') {
            for (const filePath of filePaths) {
                let dateTime = 0;
                let dateFormatted = '—';
                const fileName = filePath.split(/[/\\]/).pop();
                const regex = fileName.match(
                    /VRChat_((\d{3,})x(\d{3,})_(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})\.(\d{1,})|(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})\.(\d{3})_(\d{3,})x(\d{3,}))/
                );
                if (regex) {
                    let date, time;
                    if (typeof regex[2] !== 'undefined' && regex[4] && regex[4].length === 4) {
                        date = `${regex[4]}-${regex[5]}-${regex[6]}`;
                        time = `${regex[7]}:${regex[8]}:${regex[9]}`;
                        dateTime = Date.parse(`${date} ${time}`);
                    } else if (typeof regex[11] !== 'undefined' && regex[11] && regex[11].length === 4) {
                        date = `${regex[11]}-${regex[12]}-${regex[13]}`;
                        time = `${regex[14]}:${regex[15]}:${regex[16]}`;
                        dateTime = Date.parse(`${date} ${time}`);
                    }
                }
                if (dateTime) {
                    dateFormatted = formatDateFilter(dateTime, 'short');
                }
                results.push({
                    filePath,
                    dateTime,
                    dateFormatted,
                    world: '', // We don't extract world from filename here to keep it fast
                    playerCount: 0,
                    players: 0,
                    resolution: '',
                    match: '',
                    author: ''
                });
            }
            return results;
        }

        // Process in batches of 50 to avoid IPC/Promise exhaustion
        const batchSize = 50;
        for (let i = 0; i < filePaths.length; i += batchSize) {
            const batch = filePaths.slice(i, i + batchSize);
            const promises = batch.map(async (filePath) => {
                try {
                    const metaJson = await AppApi.GetScreenshotMetadata(filePath);
                    const meta = JSON.parse(metaJson);
                    const extraJson = await AppApi.GetExtraScreenshotData(filePath, false);
                    const extra = JSON.parse(extraJson);

                    let dateTime = 0;
                    let dateFormatted = '—';
                    if (meta.timestamp) {
                        dateTime = Date.parse(meta.timestamp);
                    } else if (extra.creationDate) {
                        dateTime = Date.parse(extra.creationDate);
                    }
                    if (dateTime) {
                        dateFormatted = formatDateFilter(dateTime, 'short');
                    }

                    let match = '';
                    if (searchType === 0 && meta.players) {
                        const matched = meta.players.filter((p) => p.displayName?.toLowerCase().includes(lowerQuery));
                        match = matched.map((p) => p.displayName).join(', ');
                    } else if (searchType === 1 && meta.players) {
                        const matched = meta.players.find((p) => p.id === query);
                        match = matched?.displayName || '';
                    }

                    results.push({
                        filePath,
                        dateTime,
                        dateFormatted,
                        world: meta.world?.name || '',
                        playerCount: meta.players?.length || 0,
                        players: meta.players?.length || 0,
                        resolution: extra.fileResolution || '',
                        match,
                        author: meta.author?.displayName || ''
                    });
                } catch (e) {
                    console.error('Error loading metadata for', filePath, e);
                }
            });
            await Promise.all(promises);
        }
        return results;
    }

    const screenshotMetadataSearchInputs = ref(0);

    onMounted(() => {
        if (!screenshotMetadataDialog.metadata.filePath) {
            screenshotMetadataDialog.search = '';
            screenshotMetadataSearch();
        }
    });

    // Keyboard shortcuts: Alt+Left (prev) / Alt+Right (next)
    const keys = useMagicKeys();
    const stopPrevWatch = whenever(keys['Alt+ArrowLeft'], () => {
        navigatePrev();
    });
    const stopNextWatch = whenever(keys['Alt+ArrowRight'], () => {
        navigateNext();
    });
    onUnmounted(() => {
        stopPrevWatch();
        stopNextWatch();
    });

    /**
     *
     */
    function navigatePrev() {
        const D = screenshotMetadataDialog;

        if (D.searchIndex !== null) {
            const filesArr = sortedSearchResults.value;
            let searchIndex = D.searchIndex;
            if (searchIndex > 0) {
                getAndDisplayScreenshot(filesArr[searchIndex - 1].filePath, false);
                searchIndex--;
            } else {
                getAndDisplayScreenshot(filesArr[filesArr.length - 1].filePath, false);
                searchIndex = filesArr.length - 1;
            }
            D.searchIndex = searchIndex;
            return;
        }

        if (D.metadata.previousFilePath) {
            getAndDisplayScreenshot(D.metadata.previousFilePath);
        }

        if (fullscreenImageDialog.value.visible) {
            // TODO
        }
    }

    /**
     *
     */
    function navigateNext() {
        const D = screenshotMetadataDialog;

        if (D.searchIndex !== null) {
            const filesArr = sortedSearchResults.value;
            let searchIndex = D.searchIndex;
            if (searchIndex < filesArr.length - 1) {
                getAndDisplayScreenshot(filesArr[searchIndex + 1].filePath, false);
                searchIndex++;
            } else {
                getAndDisplayScreenshot(filesArr[0].filePath, false);
                searchIndex = 0;
            }
            D.searchIndex = searchIndex;
            return;
        }

        if (D.metadata.nextFilePath) {
            getAndDisplayScreenshot(D.metadata.nextFilePath);
        }

        if (fullscreenImageDialog.value.visible) {
            // TODO
        }
    }

    /**
     *
     */
    function goBack() {
        router.push({ name: 'tools' });
    }

    /**
     *
     * @param event
     */
    function handleDrop(event) {
        if (currentlyDroppingFile.value === null) {
            return;
        }
        console.log('Dropped file into viewer: ', currentlyDroppingFile.value);

        screenshotMetadataResetSearch();
        getAndDisplayScreenshot(currentlyDroppingFile.value);

        event.preventDefault();
    }

    /**
     *
     */
    async function getAndDisplayScreenshotFromFile() {
        let filePath = '';

        if (LINUX) {
            filePath = await window.electron.openFileDialog();
        } else {
            filePath = await AppApi.OpenFileSelectorDialog(
                await AppApi.GetVRChatPhotosLocation(),
                '.png',
                'PNG Files (*.png)|*.png'
            );
        }

        if (filePath === '') {
            return;
        }

        screenshotMetadataResetSearch();
        getAndDisplayScreenshot(filePath);
    }

    /**
     *
     */
    function returnToAllImages() {
        const D = screenshotMetadataDialog;
        if (D.search === '' && searchResultsData.value.length > 0) {
            searchViewMode.value = 'grid';
            selectedSearchFilePath.value = null;
            D.searchIndex = null;
        } else {
            D.search = '';
            screenshotMetadataSearch();
        }
    }

    /**
     *
     * @param path
     */
    function copyImageToClipboard(path) {
        if (!path) {
            return;
        }
        AppApi.CopyImageToClipboard(path).then(() => {
            toast.success('Image copied to clipboard');
        });
    }
    /**
     *
     * @param path
     */
    function openImageFolder(path) {
        if (!path) {
            return;
        }
        AppApi.OpenFolderAndSelectItem(path).then(() => {
            toast.success('Opened image folder');
        });
    }
    /**
     *
     * @param path
     */
    function deleteMetadata(path) {
        if (!path) {
            return;
        }
        AppApi.DeleteScreenshotMetadata(path).then((result) => {
            if (!result) {
                toast.error(t('message.screenshot_metadata.delete_failed'));
                return;
            }
            toast.success(t('message.screenshot_metadata.deleted'));
            const D = screenshotMetadataDialog;
            getAndDisplayScreenshot(D.metadata.filePath, true);
        });
    }
    /**
     *
     */
    function uploadScreenshotToGallery() {
        const D = screenshotMetadataDialog;
        if (D.metadata.fileSizeBytes > 10000000) {
            toast.error(t('message.file.too_large'));
            return;
        }
        D.isUploading = true;
        AppApi.GetFileBase64(D.metadata.filePath)
            .then((base64Body) => {
                vrcPlusImageRequest
                    .uploadGalleryImage(base64Body)
                    .then((args) => {
                        handleGalleryImageAdd(args);
                        toast.success(t('message.gallery.uploaded'));
                        return args;
                    })
                    .finally(() => {
                        D.isUploading = false;
                    });
            })
            .catch((err) => {
                toast.error(t('message.gallery.failed'));
                console.error(err);
                D.isUploading = false;
            });
    }
    /**
     *
     */
    function screenshotMetadataSearch() {
        const D = screenshotMetadataDialog;

        screenshotMetadataSearchInputs.value++;
        let current = screenshotMetadataSearchInputs.value;
        setTimeout(() => {
            if (current !== screenshotMetadataSearchInputs.value) {
                return;
            }
            screenshotMetadataSearchInputs.value = 0;

            if (D.search === '') {
                D.loading = true;
                AppApi.FindScreenshotsBySearch('', 0)
                    .then(async (json) => {
                        const results = JSON.parse(json);

                        if (results.length === 0) {
                            D.metadata = {};
                            D.metadata.error = t('dialog.screenshot_metadata.no_results');

                            D.searchIndex = null;
                            D.searchResults = null;
                            searchResultsData.value = [];
                            searchViewMode.value = 'grid';
                            return;
                        }

                        D.searchIndex = 0;
                        D.searchResults = results;

                        const enriched = await loadSearchResultsMetadata(results, D.search, 0);
                        searchResultsData.value = enriched;
                        searchViewMode.value = 'grid';
                    })
                    .finally(() => {
                        D.loading = false;
                    });
                return;
            }

            const searchType = D.searchTypes.indexOf(D.searchType);
            D.loading = true;
            AppApi.FindScreenshotsBySearch(D.search, searchType)
                .then(async (json) => {
                    const results = JSON.parse(json);

                    if (results.length === 0) {
                        D.metadata = {};
                        D.metadata.error = t('dialog.screenshot_metadata.no_results');

                        D.searchIndex = null;
                        D.searchResults = null;
                        searchResultsData.value = [];
                        searchViewMode.value = 'detail';
                        return;
                    }

                    D.searchIndex = 0;
                    D.searchResults = results;

                    const enriched = await loadSearchResultsMetadata(results, D.search, searchType);
                    searchResultsData.value = enriched;
                    searchViewMode.value = 'grid';
                })
                .finally(() => {
                    D.loading = false;
                });
        }, 500);
    }

    /**
     *
     * @param value
     */
    function handleSearchTypeChange(value) {
        screenshotMetadataDialog.searchType = value;
        screenshotMetadataSearch();
    }

    /**
     *
     */
    function screenshotMetadataResetSearch() {
        const D = screenshotMetadataDialog;

        D.search = '';
        D.searchIndex = null;
        D.searchResults = null;
        searchResultsData.value = [];
        selectedSearchFilePath.value = null;
        searchViewMode.value = 'detail';
    }

    function getFileUrl(filePath) {
        if (!filePath) return '';
        try {
            if (filePath.startsWith('http') || filePath.startsWith('file:')) return filePath;
            return `file:///${filePath.replace(/\\/g, '/').split('/').map(encodeURIComponent).join('/')}`.replace(/%3A/g, ':');
        } catch {
            return filePath;
        }
    }

    /**
     *
     * @param path
     * @param needsCarouselFiles
     */
    async function getAndDisplayScreenshot(path, needsCarouselFiles = true) {
        const metadata = await AppApi.GetScreenshotMetadata(path);
        displayScreenshotMetadata(metadata, needsCarouselFiles);
    }

    /**
     * Function receives an unmodified json string grabbed from the screenshot file
     * Error checking and and verification of data is done in .NET already; In the case that the data/file is invalid, a JSON object with the token "error" will be returned containing a description of the problem.
     * Example: {"error":"Invalid file selected. Please select a valid VRChat screenshot."}
     * See docs/screenshotMetadata.json for schema
     * @param {string} json - JSON string grabbed from PNG file
     * @param {boolean} needsCarouselFiles - Whether or not to get the last/next files for the carousel
     * @returns {Promise<void>}
     */
    async function displayScreenshotMetadata(json, needsCarouselFiles = true) {
        let time;
        let date;
        const D = screenshotMetadataDialog;
        D.metadata.author = {};
        D.metadata.world = {};
        D.metadata.players = [];
        D.metadata.creationDate = '';
        D.metadata.application = '';

        let metadata = null;
        try {
            metadata = JSON.parse(json);
        } catch (e) {
            console.error('Error parsing screenshot metadata JSON:', e);
        }
        if (!metadata?.sourceFile) {
            D.metadata = {};
            D.metadata.error = t('dialog.screenshot_metadata.invalid_file');
            return;
        }

        D.loading = true;
        const extraData = await AppApi.GetExtraScreenshotData(metadata.sourceFile, needsCarouselFiles);
        D.loading = false;
        const extraDataObj = JSON.parse(extraData);
        Object.assign(metadata, extraDataObj);

        D.metadata = metadata;

        const regex = metadata.fileName?.match(
            /VRChat_((\d{3,})x(\d{3,})_(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})\.(\d{1,})|(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})\.(\d{3})_(\d{3,})x(\d{3,}))/
        );
        if (regex) {
            if (typeof regex[2] !== 'undefined' && regex[4] && regex[4].length === 4) {
                date = `${regex[4]}-${regex[5]}-${regex[6]}`;
                time = `${regex[7]}:${regex[8]}:${regex[9]}`;
                D.metadata.dateTime = Date.parse(`${date} ${time}`);
            } else if (typeof regex[11] !== 'undefined' && regex[11] && regex[11].length === 4) {
                date = `${regex[11]}-${regex[12]}-${regex[13]}`;
                time = `${regex[14]}:${regex[15]}:${regex[16]}`;
                D.metadata.dateTime = Date.parse(`${date} ${time}`);
            }
        }
        if (metadata.timestamp) {
            D.metadata.dateTime = Date.parse(metadata.timestamp);
        }
        if (!D.metadata.dateTime) {
            D.metadata.dateTime = Date.parse(metadata.creationDate);
        }

        if (fullscreenImageDialog.value.visible) {
            showFullscreenImageDialog(getFileUrl(D.metadata.filePath));
        }
    }
</script>
