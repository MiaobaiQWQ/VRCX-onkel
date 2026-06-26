<template>
    <div v-if="instance.boundPlatform || instance.boundUserId" class="flex items-center gap-2">
        <Badge :variant="statusVariant">
            {{ platformLabel }}
        </Badge>
        <Badge v-if="instance.boundPid > 0" variant="default" class="bg-green-600">
            <span class="mr-1">●</span> {{ t('view.settings.dual_instance.client_running') }}
        </Badge>
    </div>
    <span v-else class="text-sm text-muted-foreground">
        {{ t('view.settings.dual_instance.no_client_detected') }}
    </span>
</template>

<script setup>
    import { computed } from 'vue';
    import { useI18n } from 'vue-i18n';
    import { Badge } from '@/components/ui/badge';

    const props = defineProps({
        instance: {
            type: Object,
            required: true
        }
    });

    const { t } = useI18n();

    const platformLabel = computed(() => {
        switch (props.instance.boundPlatform) {
            case 'steam':
                return t('view.settings.dual_instance.platform_steam');
            case 'oculus':
                return t('view.settings.dual_instance.platform_oculus');
            case 'quest':
                return t('view.settings.dual_instance.platform_quest');
            default:
                return t('view.settings.dual_instance.platform_unknown');
        }
    });

    const statusVariant = computed(() => {
        if (props.instance.boundPid > 0) {
            return 'default';
        }
        return 'secondary';
    });
</script>
