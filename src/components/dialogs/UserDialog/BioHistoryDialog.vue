<template>
    <Dialog v-model:open="bioHistoryDialog.visible">
        <DialogContent class="sm:max-w-[600px]">
            <DialogHeader>
                <DialogTitle>{{ t('dialog.user.info.bio_history', 'Bio History') }}</DialogTitle>
                <DialogDescription>{{ userDialog.ref.displayName }}</DialogDescription>
            </DialogHeader>

            <div class="space-y-4 py-4" style="max-height: 60vh; overflow-y: auto;">
                <div v-if="loading" class="flex justify-center">
                    <Spinner class="size-6" />
                </div>
                <div v-else-if="history.length === 0" class="text-center text-muted-foreground text-sm">
                    {{ t('dialog.user.info.no_bio_history', 'No bio history found.') }}
                </div>
                <template v-else>
                    <div v-for="monthGroup in history" :key="monthGroup.month" class="space-y-4">
                        <div class="sticky top-0 bg-background/95 backdrop-blur z-10 py-1 px-2 border-l-2 border-primary font-bold text-sm text-primary">
                            {{ monthGroup.month }}
                        </div>
                        
                        <div v-for="dayGroup in monthGroup.days" :key="dayGroup.day" class="ml-2 space-y-2">
                            <div class="text-xs font-medium text-muted-foreground/80 px-2 flex items-center gap-2">
                                <div class="h-px flex-1 bg-border"></div>
                                {{ formatDateFilter(dayGroup.items[0].created_at, 'date') }}
                                <div class="h-px flex-1 bg-border"></div>
                            </div>

                            <div v-for="(item, index) in dayGroup.items" :key="index" class="border rounded-md p-3 text-sm cursor-pointer hover:bg-accent/50 transition-colors" @click="item.expanded = !item.expanded">
                                <div class="text-xs text-muted-foreground mb-2 flex justify-between items-center">
                                    <div class="flex items-center gap-2 font-mono">
                                        <span>{{ formatDateFilter(item.created_at, 'time') }}</span>
                                    </div>
                                    <ChevronDown :class="['size-3 transition-transform duration-200', item.expanded ? 'rotate-180' : '']" />
                                </div>
                                <div v-if="!item.expanded" class="text-xs text-muted-foreground truncate opacity-70">
                                    {{ item.bio || '-' }}
                                </div>
                                <pre v-else class="whitespace-pre-wrap font-[inherit] leading-relaxed mt-2 animate-in fade-in slide-in-from-top-1" v-html="item.diffHtml"></pre>
                            </div>
                        </div>
                    </div>
                </template>
            </div>

            <DialogFooter>
                <Button @click="bioHistoryDialog.visible = false">
                    {{ t('common.actions.close', 'Close') }}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>

<script setup>
    import { ref, watch } from 'vue';
    import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
    import { Button } from '@/components/ui/button';
    import { Spinner } from '@/components/ui/spinner';
    import { ChevronDown } from 'lucide-vue-next';
    import { useI18n } from 'vue-i18n';
    import { formatDateFilter } from '../../../shared/utils';
    import { database } from '../../../services/database';

    const { t } = useI18n();

    const props = defineProps({
        bioHistoryDialog: {
            type: Object,
            required: true
        },
        userDialog: {
            type: Object,
            required: true
        }
    });

    const loading = ref(false);
    const history = ref([]);

    watch(
        () => props.bioHistoryDialog.visible,
        (visible) => {
            if (visible) {
                loadHistory();
            } else {
                history.value = [];
            }
        }
    );

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

        const oldWords = oldString.split(/\s+/).flatMap((word) => word.split(/(<br>)/));
        const newWords = newString.split(/\s+/).flatMap((word) => word.split(/(<br>)/));

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

            return { oldStart: bestOldStart, newStart: bestNewStart, size: bestSize };
        }

        function buildDiff(oldStart, oldEnd, newStart, newEnd) {
            const result = [];
            const match = findLongestMatch(oldStart, oldEnd, newStart, newEnd);

            if (match.size > 0) {
                if (oldStart < match.oldStart || newStart < match.newStart) {
                    result.push(...buildDiff(oldStart, match.oldStart, newStart, match.newStart));
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

                if (match.oldStart + match.size < oldEnd || match.newStart + match.size < newEnd) {
                    result.push(...buildDiff(match.oldStart + match.size, oldEnd, match.newStart + match.size, newEnd));
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

                if (oldStart < oldEnd) result.push(...build(oldWords, oldStart, oldEnd, markerDeletion));
                if (newStart < newEnd) result.push(...build(newWords, newStart, newEnd, markerAddition));
            }

            return result;
        }

        return buildDiff(0, oldWords.length, 0, newWords.length)
            .join(' ')
            .replace(/<br>[ ]+<br>/g, '<br><br>')
            .replace(/<br> /g, '<br>');
    }

    async function loadHistory() {
        loading.value = true;
        try {
            const rawHistory = await database.getBioHistory(props.userDialog.id);

            const grouped = [];
            rawHistory.forEach((item) => {
                const date = new Date(item.created_at);
                const monthKey = date.toLocaleString('default', { month: 'long', year: 'numeric' });
                const dayKey = date.toLocaleDateString();

                let monthGroup = grouped.find((g) => g.month === monthKey);
                if (!monthGroup) {
                    monthGroup = { month: monthKey, days: [] };
                    grouped.push(monthGroup);
                }

                let dayGroup = monthGroup.days.find((d) => d.day === dayKey);
                if (!dayGroup) {
                    dayGroup = { day: dayKey, items: [] };
                    monthGroup.days.push(dayGroup);
                }

                dayGroup.items.push({
                    ...item,
                    expanded: false,
                    diffHtml: formatDifference(item.previous_bio, item.bio)
                });
            });

            history.value = grouped;
        } catch (error) {
            console.error('Failed to load bio history:', error);
        } finally {
            loading.value = false;
        }
    }
</script>

<style scoped>
    :deep(.x-text-removed) {
        text-decoration: line-through;
        color: #ef4444;
        background-color: rgba(239, 68, 68, 0.1);
        padding: 0 2px;
        border-radius: 2px;
    }

    :deep(.x-text-added) {
        color: #eab308;
        background-color: rgba(234, 179, 8, 0.1);
        padding: 0 2px;
        border-radius: 2px;
    }

    :deep(.x-text-normal) {
        color: #22c55e;
    }
</style>
