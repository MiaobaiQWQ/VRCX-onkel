<template>
    <div class="flex flex-col gap-10 py-2">
        <SettingsGroup :title="t('view.settings.dual_instance.header')">
            <div class="flex flex-col gap-6">
                <div class="flex items-center gap-4 mb-2">
                    <Button size="sm" variant="secondary" @click="handleDetectClients">
                        {{ t('view.settings.dual_instance.detect_clients') }}
                    </Button>
                </div>

                <div v-if="extraInstances.length === 0" class="text-muted-foreground text-sm">
                    {{ t('view.settings.dual_instance.empty_state') }}
                </div>

                <div v-for="instance in extraInstancesWithIndex" :key="instance.id" class="flex flex-col gap-4 rounded-lg border p-4">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-4">
                            <span class="font-medium">{{ t('view.settings.dual_instance.instance_number', { n: instance.index }) }}</span>
                            <ClientBindingStatus :instance="instance" />
                        </div>
                        <div class="flex gap-2">
                            <Button size="sm" variant="default" @click="handleLaunch(instance.id)">
                                {{ t('view.settings.dual_instance.launch') }}
                            </Button>
                            <Button size="sm" variant="destructive" @click="handleRemove(instance.id)">
                                {{ t('view.settings.dual_instance.remove') }}
                            </Button>
                        </div>
                    </div>

                    <SettingsItem
                        :label="t('view.settings.dual_instance.port')"
                        :description="t('view.settings.dual_instance.port_description')"
                    >
                        <Input
                            type="number"
                            class="w-32"
                            :model-value="instance.port"
                            @update:model-value="(v) => handleUpdate(instance.id, 'port', Number(v))"
                        />
                    </SettingsItem>

                    <SettingsItem
                        :label="t('view.settings.dual_instance.user_data_dir')"
                        :description="t('view.settings.dual_instance.user_data_dir_description')"
                    >
                        <Input
                            class="flex-1"
                            :model-value="instance.userDataDir"
                            @update:model-value="(v) => handleUpdate(instance.id, 'userDataDir', v)"
                            placeholder="C:\Path\To\Data"
                        />
                    </SettingsItem>

                    <SettingsItem
                        :label="t('view.settings.dual_instance.profile_directory')"
                        :description="t('view.settings.dual_instance.profile_directory_description')"
                    >
                        <Input
                            class="w-64"
                            :model-value="instance.profileDirectory"
                            @update:model-value="(v) => handleUpdate(instance.id, 'profileDirectory', v)"
                        />
                    </SettingsItem>

                    <SettingsItem
                        :label="t('view.settings.dual_instance.client_binding')"
                        :description="t('view.settings.dual_instance.client_binding_description')"
                    >
                        <div class="flex items-center gap-2">
                            <Select v-if="instance.boundPlatform" :model-value="instance.boundPlatform" @update:model-value="(v) => handleUpdate(instance.id, 'boundPlatform', v)">
                                <SelectTrigger class="w-32">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="steam">{{ t('view.settings.dual_instance.platform_steam') }}</SelectItem>
                                    <SelectItem value="oculus">{{ t('view.settings.dual_instance.platform_oculus') }}</SelectItem>
                                    <SelectItem value="quest">{{ t('view.settings.dual_instance.platform_quest') }}</SelectItem>
                                </SelectContent>
                            </Select>
                            <span v-if="instance.boundPid > 0" class="text-sm text-muted-foreground">
                                {{ t('view.settings.dual_instance.client_running') }} (PID: {{ instance.boundPid }})
                            </span>
                            <Button v-if="instance.boundPlatform || instance.boundUserId" size="sm" variant="ghost" @click="handleUnbind(instance.id)">
                                {{ t('view.settings.dual_instance.unbind') }}
                            </Button>
                        </div>
                    </SettingsItem>

                    <SettingsItem
                        :label="t('view.settings.dual_instance.memory_limit')"
                        :description="t('view.settings.dual_instance.memory_limit_description')"
                    >
                        <Input
                            type="number"
                            class="w-32"
                            :model-value="instance.memoryLimit"
                            @update:model-value="(v) => handleUpdate(instance.id, 'memoryLimit', Number(v))"
                        />
                    </SettingsItem>
                </div>

                <div v-if="extraInstances.length >= MAX_EXTRA_INSTANCES" class="text-muted-foreground text-sm">
                    {{ t('view.settings.dual_instance.max_instances_reached', { max: MAX_EXTRA_INSTANCES }) }}
                </div>

                <Button
                    v-else
                    size="sm"
                    variant="secondary"
                    @click="handleAdd"
                >
                    {{ t('view.settings.dual_instance.add_instance') }}
                </Button>
            </div>
        </SettingsGroup>
    </div>
</template>

<script setup>
    import { computed } from 'vue';
    import { useI18n } from 'vue-i18n';
    import { storeToRefs } from 'pinia';
    import { useGeneralSettingsStore } from '@/stores';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import SettingsGroup from '../SettingsGroup.vue';
    import SettingsItem from '../SettingsItem.vue';
    import ClientBindingStatus from './ClientBindingStatus.vue';

    const { t } = useI18n();
    const generalSettingsStore = useGeneralSettingsStore();

    const { extraInstances, MAX_EXTRA_INSTANCES } = storeToRefs(generalSettingsStore);
    const { addExtraInstance, removeExtraInstance, updateExtraInstance, launchInstanceById, detectAndBindRunningClients, unbindUserFromInstance } = generalSettingsStore;

    const extraInstancesWithIndex = computed(() => {
        return extraInstances.value.map((instance, idx) => ({
            ...instance,
            index: instance._index ?? (idx + 2)
        }));
    });

    function handleAdd() {
        addExtraInstance();
    }

    function handleRemove(id) {
        removeExtraInstance(id);
    }

    function handleUpdate(id, field, value) {
        updateExtraInstance(id, field, value);
    }

    function handleLaunch(id) {
        launchInstanceById(id);
    }

    function handleUnbind(id) {
        unbindUserFromInstance(id);
    }

    function handleDetectClients() {
        detectAndBindRunningClients();
    }
</script>
