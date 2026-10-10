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
  <div class="space-y-5">
    <p class="label-caption flex min-h-7 items-center gap-2">
      <Icon name="jannchie:database" class="h-3.5 w-3.5" />
      <span>{{ t('admin.upload.sections.edit.title') }}</span>
    </p>
    <AdminMetadataForm
      v-model:capture-time-local="captureTimeLocalModel"
      :form="formModel"
      :classify-source="{ file: props.selectedFile }"
    />
  </div>
</template>
