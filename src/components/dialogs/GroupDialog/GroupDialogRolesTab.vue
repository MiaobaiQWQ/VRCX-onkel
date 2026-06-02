<template>
    <div v-if="groupDialog.visible" class="flex flex-col gap-4">
        <div class="flex items-center justify-between px-2">
            <span class="text-base font-bold">{{ t('dialog.group.info.roles') }}</span>
            <div v-if="hasGroupPermission(groupDialog.ref, 'group-roles-manage')" class="flex gap-2">
                <Button size="sm" variant="outline" @click="showCreateRoleDialog">
                    <Plus class="mr-2 h-4 w-4" />
                    {{ t('common.actions.add') || '添加' }}
                </Button>
            </div>
        </div>

        <div class="flex flex-col gap-2 overflow-y-auto max-h-[60vh] px-2">
            <div
                v-for="role in sortedRoles"
                :key="role.id"
                class="flex flex-col gap-2 rounded-lg border p-3 hover:bg-muted/50 transition-colors">
                <div class="flex items-start justify-between">
                    <div class="flex flex-col gap-1">
                        <div class="flex items-center gap-2">
                            <span class="font-bold text-sm">{{ role.name }}</span>
                            <Badge v-if="role.isSelfAssignable" variant="secondary" class="text-[10px] h-4">
                                {{ t('dialog.group_member_moderation.self_assignable') || '可自行分配' }}
                            </Badge>
                            <Badge v-if="role.isAddedOnJoin" variant="secondary" class="text-[10px] h-4">
                                {{ t('dialog.group_member_moderation.added_on_join') || '加入时自动添加' }}
                            </Badge>
                        </div>
                        <p class="text-xs text-muted-foreground line-clamp-2">{{ role.description || '-' }}</p>
                    </div>
                    <div v-if="hasGroupPermission(groupDialog.ref, 'group-roles-manage')" class="flex gap-1">
                        <Button variant="ghost" size="icon-sm" @click="showEditRoleDialog(role)">
                            <Pencil class="h-4 w-4" />
                        </Button>
                        <Button
                            v-if="!role.isDefault"
                            variant="ghost"
                            size="icon-sm"
                            class="text-destructive"
                            @click="confirmDeleteRole(role)">
                            <Trash2 class="h-4 w-4" />
                        </Button>
                    </div>
                </div>
                <div class="flex flex-wrap gap-1 mt-1">
                    <Badge
                        v-for="permission in role.permissions"
                        :key="permission"
                        variant="outline"
                        class="text-[10px] py-0 px-1.5 font-normal">
                        {{ t(`dialog.group.permissions.${permission}`) || permission }}
                    </Badge>
                </div>
            </div>
        </div>

        <!-- Create/Edit Role Dialog -->
        <Dialog v-model:open="roleEditDialog.visible">
            <DialogContent class="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{{ roleEditDialog.isEdit ? '编辑身份组' : '创建身份组' }}</DialogTitle>
                </DialogHeader>
                <div class="grid gap-4 py-4">
                    <div class="grid gap-2">
                        <Label for="role-name">名称</Label>
                        <Input id="role-name" v-model="roleEditDialog.data.name" :disabled="roleEditDialog.isDefault" />
                        <p v-if="roleEditDialog.isDefault" class="text-[10px] text-muted-foreground">默认身份组的名称不可修改</p>
                    </div>
                    <div class="grid gap-2">
                        <Label for="role-desc">描述</Label>
                        <Textarea id="role-desc" v-model="roleEditDialog.data.description" :disabled="roleEditDialog.isDefault" />
                        <p v-if="roleEditDialog.isDefault" class="text-[10px] text-muted-foreground">默认身份组的描述不可修改</p>
                    </div>
                    <div class="flex items-center gap-2">
                        <Checkbox id="role-self" v-model:model-value="roleEditDialog.data.isSelfAssignable" />
                        <Label for="role-self">可自行分配</Label>
                    </div>
                    <div class="flex items-center gap-2">
                        <Checkbox id="role-join" v-model:model-value="roleEditDialog.data.isAddedOnJoin" />
                        <Label for="role-join">加入时自动添加</Label>
                    </div>
                    <div class="grid gap-2">
                        <Label>权限</Label>
                        <div class="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 border rounded-md">
                            <div v-for="perm in availablePermissions" :key="perm" class="flex items-center gap-2 w-full">
                                <Checkbox
                                    :id="`perm-${perm}`"
                                    v-model:model-value="roleEditDialog.permissionsMap[perm]" />
                                <Label :for="`perm-${perm}`" class="text-xs font-normal">
                                    {{ t(`dialog.group.permissions.${perm}`) || perm }}
                                </Label>
                            </div>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" @click="roleEditDialog.visible = false">取消</Button>
                    <Button :loading="roleEditDialog.loading" @click="saveRole">保存</Button>
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

    import { Button } from '@/components/ui/button';
    import { Badge } from '@/components/ui/badge';
    import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { Textarea } from '@/components/ui/textarea';
    import { Checkbox } from '@/components/ui/checkbox';

    import { hasGroupPermission } from '../../../shared/utils';
    import { useGroupStore, useModalStore } from '../../../stores';
    import { groupRequest } from '../../../api';
    import { refetchActiveEntityQuery, queryKeys } from '../../../queries';
    import { getGroupDialogGroup } from '../../../coordinators/groupCoordinator';

    const { t } = useI18n();
    const { groupDialog } = storeToRefs(useGroupStore());
    const modalStore = useModalStore();

    const sortedRoles = computed(() => {
        if (!groupDialog.value.ref?.roles) return [];
        return [...groupDialog.value.ref.roles].sort((a, b) => (a.order || 0) - (b.order || 0));
    });

    const availablePermissions = [
        'group-all',
        'group-audit-view',
        'group-announcement-manage',
        'group-bans-manage',
        'group-data-manage',
        'group-galleries-manage',
        'group-instance-manage',
        'group-invites-manage',
        'group-members-manage',
        'group-members-remove',
        'group-members-viewall',
        'group-roles-manage',
        'group-roles-assign',
        'group-default-role-manage',
        'group-moderates-manage',
        'group-instance-open-create',
        'group-instance-plus-create',
        'group-instance-public-create',
        'group-instance-join'
    ];

    const roleEditDialog = reactive({
        visible: false,
        loading: false,
        isEdit: false,
        isDefault: false,
        roleId: '',
        data: {
            name: '',
            description: '',
            isSelfAssignable: false,
            isAddedOnJoin: false,
            permissions: []
        },
        permissionsMap: {}
    });

    const updatePermissionsMap = (permissions) => {
        roleEditDialog.permissionsMap = {};
        availablePermissions.forEach((perm) => {
            roleEditDialog.permissionsMap[perm] = permissions.includes(perm);
        });
    };

    const showCreateRoleDialog = () => {
        roleEditDialog.isEdit = false;
        roleEditDialog.isDefault = false;
        roleEditDialog.roleId = '';
        roleEditDialog.data = {
            name: '',
            description: '',
            isSelfAssignable: false,
            isAddedOnJoin: false,
            permissions: []
        };
        updatePermissionsMap([]);
        roleEditDialog.visible = true;
    };

    const showEditRoleDialog = (role) => {
        roleEditDialog.isEdit = true;
        roleEditDialog.isDefault = role.isDefault;
        roleEditDialog.roleId = role.id;
        roleEditDialog.data = {
            name: role.name,
            description: role.description,
            isSelfAssignable: role.isSelfAssignable,
            isAddedOnJoin: role.isAddedOnJoin,
            permissions: [...role.permissions]
        };
        updatePermissionsMap(role.permissions);
        roleEditDialog.visible = true;
    };

    const saveRole = async () => {
        if (!roleEditDialog.data.name && !roleEditDialog.isDefault) {
            toast.error('名称不能为空');
            return;
        }

        roleEditDialog.loading = true;
        try {
            // Sync permissions from map back to data array
            roleEditDialog.data.permissions = Object.keys(roleEditDialog.permissionsMap).filter(
                (perm) => roleEditDialog.permissionsMap[perm]
            );

            if (roleEditDialog.isEdit) {
                // Build a clean payload for the request body
                let body = {};

                if (roleEditDialog.isDefault) {
                    // For default roles, only permissions are usually allowed to be modified via this endpoint
                    body = {
                        permissions: roleEditDialog.data.permissions
                    };
                } else {
                    body = {
                        name: roleEditDialog.data.name,
                        description: roleEditDialog.data.description,
                        isSelfAssignable: roleEditDialog.data.isSelfAssignable,
                        isAddedOnJoin: roleEditDialog.data.isAddedOnJoin,
                        permissions: roleEditDialog.data.permissions
                    };
                }

                await groupRequest.editGroupRole({
                    groupId: groupDialog.value.id,
                    roleId: roleEditDialog.roleId,
                    ...body
                });
                toast.success('身份组已更新');
            } else {
                const body = {
                    name: roleEditDialog.data.name,
                    description: roleEditDialog.data.description,
                    isSelfAssignable: roleEditDialog.data.isSelfAssignable,
                    isAddedOnJoin: roleEditDialog.data.isAddedOnJoin,
                    permissions: roleEditDialog.data.permissions
                };
                await groupRequest.createGroupRole({
                    groupId: groupDialog.value.id,
                    ...body
                });
                toast.success('身份组已创建');
            }
            roleEditDialog.visible = false;
            // Refetch group data to update roles list
            await refetchActiveEntityQuery(queryKeys.group(groupDialog.value.id, true));
            // Also call coordinator to update store state
            await getGroupDialogGroup(groupDialog.value.id);
        } catch (err) {
            console.error(err);
            toast.error('操作失败');
        } finally {
            roleEditDialog.loading = false;
        }
    };

    const confirmDeleteRole = async (role) => {
        const { ok } = await modalStore.confirm({
            title: '删除身份组',
            description: `确定要删除身份组 "${role.name}" 吗？此操作无法撤销。`,
            destructive: true
        });

        if (ok) {
            try {
                await groupRequest.deleteGroupRole({
                    groupId: groupDialog.value.id,
                    roleId: role.id
                });
                toast.success('身份组已删除');
                await refetchActiveEntityQuery(queryKeys.group(groupDialog.value.id, true));
                await getGroupDialogGroup(groupDialog.value.id);
            } catch (err) {
                console.error(err);
                toast.error('删除失败');
            }
        }
    };
</script>
