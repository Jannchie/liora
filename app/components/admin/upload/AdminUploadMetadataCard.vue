<script setup lang="ts">
import type { MediaFormState } from '~/types/admin'

const props = defineProps<{
  form: MediaFormState
  captureTimeLocal: string
  selectedFile: File | null
}>()

const emit = defineEmits<{
  'update:form': [value: MediaFormState]
  'update:captureTimeLocal': [value: string]
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
  <div class="space-y-6">
    <div class="flex items-center gap-2">
      <Icon name="tabler:database-edit" class="h-4 w-4 text-muted" />
      <p class="label-caption">
        {{ t('admin.upload.sections.edit.title') }}
      </p>
    </div>
    <AdminMetadataForm
      :form="formModel"
      v-model:capture-time-local="captureTimeLocalModel"
      :classify-source="{ file: props.selectedFile }"
    />
  </div>
</template>
