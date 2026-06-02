<template>
    <div v-if="groupDialog.visible" class="flex flex-col gap-4">
        <div class="flex items-center justify-between px-2">
            <span class="text-base font-bold">群组活动</span>
            <div v-if="hasGroupPermission(groupDialog.ref, 'group-announcement-manage')" class="flex gap-2">
                <Button size="sm" variant="outline" @click="showCreateEventDialog">
                    <Plus class="mr-2 h-4 w-4" />
                    {{ t('common.actions.add') || '添加' }}
                </Button>
            </div>
        </div>

        <TabsUnderline v-model="activeEventTab" :items="eventTabs" class="px-2">
            <template #upcoming>
                <div class="grid-view flex flex-wrap gap-4 overflow-y-auto max-h-[60vh] py-2.5">
                    <template v-if="upcomingEvents.length > 0">
                        <GroupCalendarEventCard
                            v-for="event in upcomingEvents"
                            :key="event.id"
                            :event="event"
                            :is-following="event.userInterest?.isFollowing"
                            @update-following-calendar-data="updateFollowingCalendarData"
                            mode="grid"
                            card-class="group-dialog-grid-card">
                            <template #actions v-if="hasGroupPermission(groupDialog.ref, 'group-announcement-manage')">
                                <div class="flex gap-1 mt-2">
                                    <Button size="xs" variant="ghost" @click.stop="showEditEventDialog(event)">
                                        <Pencil class="h-3 w-3 mr-1" />
                                        编辑
                                    </Button>
                                    <Button size="xs" variant="ghost" class="text-destructive" @click.stop="confirmDeleteEvent(event)">
                                        <Trash2 class="h-3 w-3 mr-1" />
                                        删除
                                    </Button>
                                </div>
                            </template>
                        </GroupCalendarEventCard>
                    </template>
                    <div v-else class="flex-1 text-center py-10 text-muted-foreground">
                        暂无即将到来的活动
                    </div>
                </div>
            </template>
            <template #past>
                <div class="grid-view flex flex-wrap gap-4 overflow-y-auto max-h-[60vh] py-2.5">
                    <template v-if="pastEvents.length > 0">
                        <GroupCalendarEventCard
                            v-for="event in pastEvents"
                            :key="event.id"
                            :event="event"
                            :is-following="event.userInterest?.isFollowing"
                            @update-following-calendar-data="updateFollowingCalendarData"
                            mode="grid"
                            card-class="group-dialog-grid-card" />
                    </template>
                    <div v-else class="flex-1 text-center py-10 text-muted-foreground">
                        暂无过往活动
                    </div>
                </div>
            </template>
        </TabsUnderline>

        <!-- Create/Edit Event Dialog (Placeholder - would be a larger form in real implementation) -->
        <Dialog v-model:open="eventEditDialog.visible">
            <DialogContent class="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>{{ eventEditDialog.isEdit ? '编辑活动' : '创建活动' }}</DialogTitle>
                </DialogHeader>
                <div class="grid gap-4 py-4 overflow-y-auto max-h-[70vh]">
                    <div class="grid gap-2">
                        <Label for="event-title">标题</Label>
                        <Input id="event-title" v-model="eventEditDialog.data.title" />
                    </div>
                    <div class="grid gap-2">
                        <Label for="event-desc">描述</Label>
                        <Textarea id="event-desc" v-model="eventEditDialog.data.description" />
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div class="grid gap-2">
                            <Label for="event-start">开始时间</Label>
                            <Input id="event-start" type="datetime-local" v-model="eventEditDialog.data.startsAt" />
                        </div>
                        <div class="grid gap-2">
                            <Label for="event-end">结束时间</Label>
                            <Input id="event-end" type="datetime-local" v-model="eventEditDialog.data.endsAt" />
                        </div>
                    </div>
                    <div class="grid gap-2">
                        <Label>可见性</Label>
                        <Select v-model="eventEditDialog.data.accessType">
                            <SelectTrigger>
                                <SelectValue placeholder="选择可见性" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="public">公开</SelectItem>
                                <SelectItem value="group">仅群组</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <!-- Add more fields as needed: platforms, languages, imageId, etc. -->
                </div>
                <DialogFooter>
                    <Button variant="outline" @click="eventEditDialog.visible = false">取消</Button>
                    <Button :loading="eventEditDialog.loading" @click="saveEvent">保存</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
</template>

<script setup>
    import { computed, reactive, ref } from 'vue';
    import { Pencil, Plus, Trash2 } from 'lucide-vue-next';
    import { storeToRefs } from 'pinia';
    import { useI18n } from 'vue-i18n';
    import { toast } from 'vue-sonner';
    import dayjs from 'dayjs';

    import { Button } from '@/components/ui/button';
    import { TabsUnderline } from '@/components/ui/tabs';
    import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { Textarea } from '@/components/ui/textarea';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

    import { hasGroupPermission } from '../../../shared/utils';
    import { useGroupStore, useModalStore } from '../../../stores';
    import { groupRequest } from '../../../api';
    import { refetchActiveEntityQuery, queryKeys } from '../../../queries';
    import { getGroupDialogGroup } from '../../../coordinators/groupCoordinator';
    import GroupCalendarEventCard from '../../../views/Tools/components/GroupCalendarEventCard.vue';

    const { t } = useI18n();
    const { groupDialog } = storeToRefs(useGroupStore());
    const modalStore = useModalStore();

    const activeEventTab = ref('upcoming');
    const eventTabs = [
        { value: 'upcoming', label: '即将到来' },
        { value: 'past', label: '过往活动' }
    ];

    const upcomingEvents = computed(() => {
        if (!groupDialog.value.calendar) return [];
        return groupDialog.value.calendar.filter(e => dayjs(e.endsAt).isAfter(dayjs())).sort((a, b) => dayjs(a.startsAt).diff(dayjs(b.startsAt)));
    });

    const pastEvents = computed(() => {
        if (!groupDialog.value.calendar) return [];
        return groupDialog.value.calendar.filter(e => dayjs(e.endsAt).isBefore(dayjs())).sort((a, b) => dayjs(b.startsAt).diff(dayjs(a.startsAt)));
    });

    const eventEditDialog = reactive({
        visible: false,
        loading: false,
        isEdit: false,
        eventId: '',
        data: {
            title: '',
            description: '',
            startsAt: '',
            endsAt: '',
            accessType: 'group',
            category: 'other',
            tags: [],
            platforms: ['windows'],
            languages: ['en']
        }
    });

    const showCreateEventDialog = () => {
        eventEditDialog.isEdit = false;
        eventEditDialog.eventId = '';
        eventEditDialog.data = {
            title: '',
            description: '',
            startsAt: dayjs().add(1, 'hour').format('YYYY-MM-DDTHH:mm'),
            endsAt: dayjs().add(2, 'hour').format('YYYY-MM-DDTHH:mm'),
            accessType: 'group',
            category: 'other',
            tags: [],
            platforms: ['windows'],
            languages: ['en']
        };
        eventEditDialog.visible = true;
    };

    const showEditEventDialog = (event) => {
        eventEditDialog.isEdit = true;
        eventEditDialog.eventId = event.id;
        eventEditDialog.data = {
            title: event.title,
            description: event.description,
            startsAt: dayjs(event.startsAt).format('YYYY-MM-DDTHH:mm'),
            endsAt: dayjs(event.endsAt).format('YYYY-MM-DDTHH:mm'),
            accessType: event.accessType,
            category: event.category || 'other',
            tags: event.tags || [],
            platforms: event.platforms || ['windows'],
            languages: event.languages || ['en']
        };
        eventEditDialog.visible = true;
    };

    const saveEvent = async () => {
        if (!eventEditDialog.data.title) {
            toast.error('标题不能为空');
            return;
        }

        eventEditDialog.loading = true;
        try {
            const payload = {
                ...eventEditDialog.data,
                startsAt: dayjs(eventEditDialog.data.startsAt).toISOString(),
                endsAt: dayjs(eventEditDialog.data.endsAt).toISOString()
            };

            if (eventEditDialog.isEdit) {
                await groupRequest.editGroupEvent({
                    groupId: groupDialog.value.id,
                    eventId: eventEditDialog.eventId,
                    ...payload
                });
                toast.success('活动已更新');
            } else {
                await groupRequest.createGroupEvent({
                    groupId: groupDialog.value.id,
                    ...payload
                });
                toast.success('活动已创建');
            }
            eventEditDialog.visible = false;
            // Trigger refresh of group data
            await refetchActiveEntityQuery(queryKeys.group(groupDialog.value.id, true));
            await getGroupDialogGroup(groupDialog.value.id);
        } catch (err) {
            console.error(err);
            toast.error('操作失败');
        } finally {
            eventEditDialog.loading = false;
        }
    };

    const confirmDeleteEvent = async (event) => {
        const { ok } = await modalStore.confirm({
            title: '删除活动',
            description: `确定要删除活动 "${event.title}" 吗？`,
            destructive: true
        });

        if (ok) {
            try {
                await groupRequest.deleteGroupEvent({
                    groupId: groupDialog.value.id,
                    eventId: event.id
                });
                toast.success('活动已删除');
                await refetchActiveEntityQuery(queryKeys.group(groupDialog.value.id, true));
                await getGroupDialogGroup(groupDialog.value.id);
            } catch (err) {
                console.error(err);
                toast.error('删除失败');
            }
        }
    };

    const updateFollowingCalendarData = () => {
        // Implementation for updating following status if needed
    };
</script>
