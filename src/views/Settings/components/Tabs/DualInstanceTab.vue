<template>
    <div class="flex flex-col gap-10 py-2">
        <SettingsGroup :title="t('view.settings.dual_instance.header')">
            <div class="flex gap-2 mb-4">
                <Button size="sm" variant="default" @click="launchInstance2">
                    {{ t('view.settings.dual_instance.launch_instance_2') }}
                </Button>
            </div>
            
            <SettingsItem 
                :label="t('view.settings.dual_instance.port')" 
                :description="t('view.settings.dual_instance.port_description')"
            >
                <Input 
                    type="number" 
                    class="w-32" 
                    :model-value="dualInstancePort" 
                    @update:model-value="setDualInstancePort" 
                />
            </SettingsItem>

            <SettingsItem 
                :label="t('view.settings.dual_instance.user_data_dir')" 
                :description="t('view.settings.dual_instance.user_data_dir_description')"
            >
                <div class="flex gap-2">
                    <Input 
                        class="flex-1" 
                        :model-value="dualInstanceUserDataDir" 
                        @update:model-value="setDualInstanceUserDataDir" 
                        placeholder="C:\Path\To\Data"
                    />
                </div>
            </SettingsItem>

            <SettingsItem 
                :label="t('view.settings.dual_instance.profile_directory')" 
                :description="t('view.settings.dual_instance.profile_directory_description')"
            >
                <Input 
                    class="w-64" 
                    :model-value="dualInstanceProfileDirectory" 
                    @update:model-value="setDualInstanceProfileDirectory" 
                />
            </SettingsItem>

            <SettingsItem 
                :label="t('view.settings.dual_instance.memory_limit')" 
                :description="t('view.settings.dual_instance.memory_limit_description')"
            >
                <Input 
                    type="number" 
                    class="w-32" 
                    :model-value="dualInstanceMemoryLimit" 
                    @update:model-value="setDualInstanceMemoryLimit" 
                />
            </SettingsItem>
        </SettingsGroup>

        <SettingsGroup :title="t('view.settings.dual_instance.instance_2_features')">
            <SettingsItem 
                :label="t('view.settings.dual_instance.enable_jirai_features')" 
                :description="t('view.settings.dual_instance.enable_jirai_features_description')"
            >
                <Switch 
                    :model-value="enableJiraiFeatures" 
                    @update:model-value="setEnableJiraiFeatures" 
                />
            </SettingsItem>

            <SettingsItem 
                :label="t('view.settings.dual_instance.read_only_sync')" 
                :description="t('view.settings.dual_instance.read_only_sync_description')"
            >
                <Switch 
                    :model-value="readOnlySync" 
                    @update:model-value="setReadOnlySync" 
                />
            </SettingsItem>
        </SettingsGroup>
    </div>
</template>

<script setup>
    import { useI18n } from 'vue-i18n';
    import { storeToRefs } from 'pinia';
    import { useGeneralSettingsStore } from '@/stores';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Switch } from '@/components/ui/switch';
    import SettingsGroup from '../SettingsGroup.vue';
    import SettingsItem from '../SettingsItem.vue';

    const { t } = useI18n();
    const generalSettingsStore = useGeneralSettingsStore();

    const {
        dualInstancePort,
        dualInstanceUserDataDir,
        dualInstanceProfileDirectory,
        enableJiraiFeatures,
        readOnlySync,
        dualInstanceMemoryLimit
    } = storeToRefs(generalSettingsStore);

    const {
        setDualInstancePort,
        setDualInstanceUserDataDir,
        setDualInstanceProfileDirectory,
        setEnableJiraiFeatures,
        setReadOnlySync,
        setDualInstanceMemoryLimit
    } = generalSettingsStore;

    function launchInstance2() {
        if (typeof AppApi !== 'undefined' && AppApi.LaunchInstance2) {
            AppApi.LaunchInstance2(
                dualInstanceUserDataDir.value,
                dualInstanceProfileDirectory.value,
                dualInstancePort.value,
                dualInstanceMemoryLimit.value
            );
        }
    }
</script>
