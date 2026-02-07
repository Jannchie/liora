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
  <UCard class="border border-default/50 bg-default/70">
    <template #header>
      <div class="space-y-1">
        <h2 class="flex items-center gap-2 text-xl font-semibold">
          <Icon name="tabler:database-edit" class="h-5 w-5 text-primary" />
          <span>{{ t('admin.upload.sections.edit.title') }}</span>
        </h2>
      </div>
    </template>
    <div class="space-y-6">
      <AdminMetadataForm
        v-model:form="formModel"
        v-model:capture-time-local="captureTimeLocalModel"
        :classify-source="{ file: props.selectedFile }"
      />

      <div class="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <UButton
          variant="soft"
          color="neutral"
          type="button"
          class="w-full sm:w-auto"
          icon="tabler:x"
          @click="emit('clearSelection')"
        >
          {{ t('common.actions.cancel') }}
        </UButton>
        <UButton
          color="primary"
          type="submit"
          :loading="props.submitting"
          :disabled="!props.selectedFile"
          class="w-full sm:w-auto"
          icon="tabler:device-floppy"
        >
          {{ t('admin.upload.actions.save') }}
        </UButton>
      </div>
    </div>
  </UCard>
</template>
