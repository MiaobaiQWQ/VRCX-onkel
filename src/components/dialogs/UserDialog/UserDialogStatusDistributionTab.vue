<template>
    <div class="flex min-w-0 flex-col overflow-x-hidden" style="min-height: 200px">
        <!-- Toolbar -->
        <div class="flex items-center justify-between">
            <div class="flex items-center">
                <Button
                    class="rounded-full"
                    variant="ghost"
                    size="icon-sm"
                    :disabled="isLoading"
                    :title="t('dialog.user.status_distribution.refresh_hint')"
                    @click="loadData(true)">
                    <Spinner v-if="isLoading" />
                    <RefreshCw v-else />
                </Button>
            </div>
        </div>

        <!-- Loading -->
        <div
            v-if="isLoading && !hasData"
            class="flex flex-col items-center justify-center flex-1 mt-8 gap-2">
            <Spinner class="h-5 w-5" />
            <span class="text-sm text-muted-foreground">
                {{ t('dialog.user.status_distribution.loading') }}
            </span>
        </div>

        <!-- No data -->
        <div
            v-else-if="!isLoading && !hasData"
            class="flex items-center justify-center flex-1 mt-8">
            <DataTableEmpty type="nodata" />
        </div>

        <!-- Chart -->
        <div v-show="hasData" class="flex flex-col gap-4 min-w-0 flex-1 overflow-y-auto pr-2 custom-scrollbar">
            <!-- Daily Stacked Bar Chart -->
            <div class="flex flex-col gap-2">
                <div class="px-4 text-xs font-medium text-muted-foreground flex items-center gap-2">
                    <Calendar class="size-3.5" />
                    {{ t('view.charts.instance_activity.online_time') }}
                </div>
                <div
                    ref="barChartDomRef"
                    class="min-w-0 flex-1"
                    style="width: 100%; min-height: 320px"
                    role="img"
                    :aria-label="t('dialog.user.status_distribution.header')" />
            </div>
        </div>
    </div>
</template>

<script setup>
    defineOptions({ name: 'UserDialogStatusDistributionTab' });

    import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
    import { Calendar, RefreshCw } from 'lucide-vue-next';
    import { storeToRefs } from 'pinia';
    import { useI18n } from 'vue-i18n';
    import dayjs from 'dayjs';
    import * as echarts from 'echarts';

    import { Button } from '@/components/ui/button';
    import { DataTableEmpty } from '@/components/ui/data-table';
    import { Spinner } from '@/components/ui/spinner';

    import { database } from '../../../services/database';
    import { useAppearanceSettingsStore, useUserStore } from '../../../stores';

    const { t } = useI18n();
    const { userDialog } = storeToRefs(useUserStore());
    const { isDarkMode } = storeToRefs(useAppearanceSettingsStore());

    // ─── Status colors matching VRChat official palette ──────────────────────────
    const STATUS_COLORS = {
        active:   '#2ED319',
        'join me': '#00B8FF',
        'ask me': '#E97C03',
        busy:     '#C80928'
    };

    // ─── Status keys in display order ────────────────────────────────────────────
    const STATUS_KEYS = ['join me', 'active', 'ask me', 'busy'];

    // ─── State ────────────────────────────────────────────────────────────────────
    const isLoading = ref(false);
    const rawStatusRows = ref([]);
    const rawOnlineRows = ref([]);
    const barChartDomRef = ref(null);
    let barEchartsInstance = null;
    let resizeObserver = null;

    const DEFAULT_VISIBLE_BUCKETS = 14; // Show 2 weeks by default

    const hasData = computed(() => rawStatusRows.value.length > 0);

    // ─── Build chart data from rawStatusRows & rawOnlineRows ──────────────────────
    function buildChartData() {
        const statusRows = rawStatusRows.value;
        if (!statusRows.length) return null;

        const onlineRows = rawOnlineRows.value;

        // 1. Get total time range (aligned to calendar days)
        let firstMs = Date.parse(statusRows[0].createdAt);
        let lastMs = Date.parse(statusRows[statusRows.length - 1].createdAt);

        if (onlineRows.length) {
            const firstOnlineMs = Date.parse(onlineRows[0].createdAt);
            const lastOnlineMs = Date.parse(onlineRows[onlineRows.length - 1].createdAt);
            firstMs = Math.min(firstMs, firstOnlineMs);
            lastMs = Math.max(lastMs, lastOnlineMs);
        }

        const startDate = dayjs(firstMs).startOf('day');
        const endDate = dayjs(lastMs).endOf('day');
        
        // 2. Pre-process intervals
        const statusIntervals = [];
        for (let i = 0; i < statusRows.length; i++) {
            const start = Date.parse(statusRows[i].createdAt);
            const end = i < statusRows.length - 1 ? Date.parse(statusRows[i + 1].createdAt) : Date.now();
            if (end > start) {
                statusIntervals.push({ start, end, status: statusRows[i].status });
            }
        }

        const onlineIntervals = [];
        for (let i = 0; i < onlineRows.length; i++) {
            if (onlineRows[i].type === 'Online') {
                const start = Date.parse(onlineRows[i].createdAt);
                let end = Date.now();
                for (let j = i + 1; j < onlineRows.length; j++) {
                    if (onlineRows[j].type === 'Offline' || onlineRows[j].type === 'Online') {
                        end = Date.parse(onlineRows[j].createdAt);
                        break;
                    }
                }
                if (end > start) {
                    onlineIntervals.push({ start, end });
                }
            }
        }

        // 3. Intersect Status & Online
        const activeIntervals = [];
        if (onlineIntervals.length === 0) {
            activeIntervals.push(...statusIntervals);
        } else {
            for (const s of statusIntervals) {
                for (const o of onlineIntervals) {
                    if (o.start >= s.end) break;
                    if (o.end <= s.start) continue;

                    const intersectStart = Math.max(s.start, o.start);
                    const intersectEnd = Math.min(s.end, o.end);
                    if (intersectEnd > intersectStart) {
                        activeIntervals.push({
                            start: intersectStart,
                            end: intersectEnd,
                            status: s.status
                        });
                    }
                }
            }
        }

        // 4. Accumulate into buckets
        const groupedData = new Map(); // Key: label, Value: status hours map
        const labels = [];

        let current = startDate;
        while (current.isBefore(endDate) || current.isSame(endDate, 'day')) {
            const label = current.format('YYYY-MM-DD');
            labels.push(label);
            groupedData.set(label, { active: 0, 'join me': 0, 'ask me': 0, busy: 0, total: 0 });
            current = current.add(1, 'day');
        }

        for (const interval of activeIntervals) {
            const statusKey = interval.status;
            let current = interval.start;
            const end = interval.end;

            while (current < end) {
                const d = dayjs(current);
                const label = d.format('YYYY-MM-DD');
                const bucketEndMs = d.endOf('day').valueOf() + 1;

                const partEnd = Math.min(end, bucketEndMs);
                const partDuration = partEnd - current;

                const bucket = groupedData.get(label);
                if (bucket && statusKey in bucket) {
                    bucket[statusKey] += partDuration;
                    bucket.total += partDuration;
                }
                current = partEnd;
            }
        }

        const series = STATUS_KEYS.map((status) => ({
            name: t(`dialog.user.status_distribution.status.${status.replace(' ', '_')}`),
            type: 'bar',
            stack: 'total',
            barMaxWidth: 30,
            itemStyle: { borderRadius: [0, 0, 0, 0] },
            color: STATUS_COLORS[status],
            emphasis: { focus: 'series' },
            data: labels.map((label) => +(groupedData.get(label)[status] / 3600000).toFixed(2))
        }));

        return { xLabels: labels, series, bucketCount: labels.length };
    }

    // ─── ECharts option builder ───────────────────────────────────────────────────
    function buildBarOption(chartData) {
        const { xLabels, series, bucketCount } = chartData;
        const isDark = isDarkMode.value;

        const zoomStart =
            bucketCount <= DEFAULT_VISIBLE_BUCKETS
                ? 0
                : ((bucketCount - DEFAULT_VISIBLE_BUCKETS) / bucketCount) * 100;

        return {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                formatter(params) {
                    const header = `<div style="margin-bottom:6px;font-weight:600;font-size:12px">${params[0]?.axisValue}</div>`;
                    const items = params
                        .filter((p) => p.value > 0)
                        .sort((a, b) => b.value - a.value);
                    if (!items.length) return '';
                    const rows = items
                        .map((p) =>
                            `<div style="display:flex;align-items:center;gap:6px;padding:2px 4px">` +
                            `<span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${p.color};flex-shrink:0"></span>` +
                            `<span style="flex:1;font-size:12px">${p.seriesName}</span>` +
                            `<span style="font-size:12px;font-weight:600;tabular-nums">${p.value.toFixed(2)}h</span>` +
                            `</div>`
                        )
                        .join('');
                    return header + rows;
                }
            },
            legend: {
                top: 0,
                type: 'plain',
                textStyle: { color: isDark ? '#ccc' : '#333', fontSize: 11 },
                data: series.map((s) => s.name)
            },
            grid: { left: '3%', right: '2%', top: 36, bottom: 80, containLabel: true },
            xAxis: {
                type: 'category',
                data: xLabels,
                boundaryGap: true,
                axisLabel: { rotate: 30, fontSize: 10, color: isDark ? '#bbb' : '#555' },
                axisLine: { lineStyle: { color: isDark ? '#444' : '#ddd' } }
            },
            yAxis: {
                type: 'value',
                name: 'Hours',
                axisLabel: { formatter: '{value}h', color: isDark ? '#bbb' : '#555', fontSize: 11 },
                splitLine: { lineStyle: { color: isDark ? '#333' : '#eee' } }
            },
            dataZoom: [
                {
                    type: 'slider',
                    show: true,
                    xAxisIndex: [0],
                    start: zoomStart,
                    end: 100,
                    bottom: 5,
                    height: 20,
                    borderColor: 'transparent',
                    fillerColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                    handleStyle: { color: isDark ? '#888' : '#aaa' }
                },
                { type: 'inside', xAxisIndex: [0], start: zoomStart, end: 100 }
            ],
            series
        };
    }

    // ─── Chart lifecycle ──────────────────────────────────────────────────────────
    function rebuildChart() {
        const chartData = buildChartData();
        if (!chartData) return;

        // Init/Update Bar
        if (barChartDomRef.value) {
            if (!barEchartsInstance) {
                barEchartsInstance = echarts.init(barChartDomRef.value, isDarkMode.value ? 'dark' : null);
                resizeObserver = new ResizeObserver(() => {
                    barEchartsInstance?.resize();
                });
                resizeObserver.observe(barChartDomRef.value);
            }
            barEchartsInstance.setOption(buildBarOption(chartData), { notMerge: true });
        }
    }

    function disposeChart() {
        resizeObserver?.disconnect();
        resizeObserver = null;
        barEchartsInstance?.dispose();
        barEchartsInstance = null;
    }

    // ─── Data loading ──────────────────────────────────────────────────────────────
    async function loadData(forceRefresh = false) {
        const userId = userDialog.value?.id;
        if (!userId) return;
        if (!forceRefresh && rawStatusRows.value.length > 0 && lastLoadedUserId === userId) return;

        isLoading.value = true;
        try {
            const [status, online] = await Promise.all([
                database.getStatusHistoryForUser(userId),
                database.getOnlineOfflineHistoryForUser(userId)
            ]);
            rawStatusRows.value = status;
            rawOnlineRows.value = online;
            lastLoadedUserId = userId;
        } catch (err) {
            console.error('[StatusDistribution] Failed to load data', err);
            rawStatusRows.value = [];
            rawOnlineRows.value = [];
        } finally {
            isLoading.value = false;
        }
        await nextTick();
        rebuildChart();
    }

    let lastLoadedUserId = '';

    // ─── Public API ────────────────────────────────────────────────────────────────
    function loadStatusDistribution(userId) {
        if (!userId || userDialog.value?.id !== userId) return;
        void loadData();
    }

    defineExpose({ loadStatusDistribution });

    // ─── Watchers ──────────────────────────────────────────────────────────────────
    watch(
        () => userDialog.value?.id,
        () => {
            rawStatusRows.value = [];
            rawOnlineRows.value = [];
            lastLoadedUserId = '';
            disposeChart();
        }
    );

    watch(isDarkMode, () => {
        disposeChart();
        nextTick(() => rebuildChart());
    });

    watch(
        () => userDialog.value?.visible,
        (visible) => {
            if (visible && userDialog.value?.activeTab === 'status-distribution') {
                void loadData();
            }
        }
    );

    onMounted(() => {
        if (userDialog.value?.visible && userDialog.value?.activeTab === 'status-distribution') {
            void loadData();
        }
    });

    onBeforeUnmount(() => {
        disposeChart();
    });
</script>

<style scoped>
    .custom-scrollbar::-webkit-scrollbar {
        width: 4px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
        background-color: rgba(0, 0, 0, 0.1);
        border-radius: 2px;
    }
    .dark .custom-scrollbar::-webkit-scrollbar-thumb {
        background-color: rgba(255, 255, 255, 0.1);
    }
</style>
