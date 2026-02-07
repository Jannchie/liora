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
  <div class="space-y-3 rounded-2xl border border-default/50 bg-default/60 p-4 shadow-sm">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex items-center gap-3">
        <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/10">
          <Icon name="tabler:database-edit" class="h-5 w-5" />
        </div>
        <div class="space-y-0.5">
          <p class="text-xs font-semibold uppercase tracking-wide text-muted">
            {{ t('admin.upload.sections.edit.title') }}
          </p>
          <p class="text-base font-semibold text-highlighted">
            {{ props.displayFileName }}
          </p>
        </div>
      </div>
      <div class="hidden shrink-0 items-center gap-2 sm:flex">
        <UButton
          variant="soft"
          color="neutral"
          type="button"
          icon="tabler:x"
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
    <div v-if="props.previewChips.length > 0" class="flex flex-wrap gap-2">
      <span
        v-for="chip in props.previewChips"
        :key="`${chip.icon}-${chip.text}`"
        class="inline-flex items-center gap-2 rounded-full bg-elevated/80 px-3 py-1 text-xs font-medium text-highlighted ring-1 ring-default/50"
      >
        <Icon :name="chip.icon" class="h-4 w-4 text-primary" />
        <span>{{ chip.text }}</span>
      </span>
    </div>
    <div class="flex flex-col gap-2 sm:hidden">
      <UButton
        variant="soft"
        color="neutral"
        type="button"
        icon="tabler:x"
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
