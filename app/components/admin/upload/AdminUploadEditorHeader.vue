<script setup lang="ts">
const props = defineProps<{
  displayFileName: string
  previewChips: Array<{ icon: string, text: string }>
  submitting: boolean
  hasSelectedFile: boolean
}>()

const emit = defineEmits<{
  clearSelection: []
}>()

const { t } = useI18n()
</script>

<template>
  <div class="space-y-3 border-y border-border-muted py-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="min-w-0 space-y-1">
        <p class="label-caption">
          {{ t('admin.upload.sections.edit.title') }}
        </p>
        <p class="truncate font-mono text-sm text-highlighted">
          {{ props.displayFileName }}
        </p>
      </div>
      <div class="hidden shrink-0 items-center gap-2 sm:flex">
        <UButton
          variant="ghost"
          color="neutral"
          type="button"
          @click="emit('clearSelection')"
        >
          {{ t('common.actions.cancel') }}
        </UButton>
        <UButton
          color="primary"
          type="submit"
          :loading="props.submitting"
          :disabled="!props.hasSelectedFile"
          icon="tabler:device-floppy"
        >
          {{ t('admin.upload.actions.save') }}
        </UButton>
      </div>
    </div>
    <div v-if="props.previewChips.length > 0" class="flex flex-wrap items-center gap-x-4 gap-y-1 num-tabular text-[11px] text-muted">
      <span
        v-for="chip in props.previewChips"
        :key="`${chip.icon}-${chip.text}`"
        class="inline-flex items-center gap-1.5"
      >
        <Icon :name="chip.icon" class="h-3.5 w-3.5" />
        <span>{{ chip.text }}</span>
      </span>
    </div>
    <div class="flex flex-col gap-2 sm:hidden">
      <UButton
        variant="ghost"
        color="neutral"
        type="button"
        @click="emit('clearSelection')"
      >
        {{ t('common.actions.cancel') }}
      </UButton>
      <UButton
        color="primary"
        type="submit"
        :loading="props.submitting"
        :disabled="!props.hasSelectedFile"
        icon="tabler:device-floppy"
      >
        {{ t('admin.upload.actions.save') }}
      </UButton>
    </div>
  </div>
</template>
