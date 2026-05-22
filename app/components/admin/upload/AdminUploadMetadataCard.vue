<script setup lang="ts">
import type { MediaFormState } from '~/types/admin'

const props = defineProps<{
  form: MediaFormState
  captureTimeLocal: string
  selectedFile: File | null
  submitting: boolean
}>()

const emit = defineEmits<{
  'update:form': [value: MediaFormState]
  'update:captureTimeLocal': [value: string]
  'clearSelection': []
}>()

const { t } = useI18n()

const formModel = computed<MediaFormState>({
  get: () => props.form,
  set: value => emit('update:form', value),
})

const captureTimeLocalModel = computed<string>({
  get: () => props.captureTimeLocal,
  set: value => emit('update:captureTimeLocal', value),
})
</script>

<template>
  <USection
    :label="t('admin.upload.sections.edit.title')"
    icon="tabler:database-edit"
  >
    <div class="space-y-6">
      <AdminMetadataForm
        :form="formModel"
        v-model:capture-time-local="captureTimeLocalModel"
        :classify-source="{ file: props.selectedFile }"
      />

      <div class="flex flex-col gap-2 border-t border-border-muted pt-4 sm:flex-row sm:justify-end">
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
          :disabled="!props.selectedFile"
          icon="tabler:device-floppy"
        >
          {{ t('admin.upload.actions.save') }}
        </UButton>
      </div>
    </div>
  </USection>
</template>
