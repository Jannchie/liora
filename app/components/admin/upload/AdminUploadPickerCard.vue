<script setup lang="ts">
type UploadMode = 'image' | 'live'

const props = defineProps<{
  uploadMode: UploadMode
  uploadValue: File | null
  videoValue: File | null
  setFileUploadRef: (instance: unknown) => void
  setVideoUploadRef: (instance: unknown) => void
}>()

const emit = defineEmits<{
  'update:uploadValue': [value: File | null]
  'update:videoValue': [value: File | null]
  'selectMode': [value: UploadMode]
}>()

const { t } = useI18n()

const uploadValueModel = computed<File | null>({
  get: () => props.uploadValue,
  set: value => emit('update:uploadValue', value),
})

const videoValueModel = computed<File | null>({
  get: () => props.videoValue,
  set: value => emit('update:videoValue', value),
})
</script>

<template>
  <USection
    :label="t('admin.upload.sections.upload.label')"
    icon="tabler:upload"
  >
    <div class="space-y-5">
      <div class="inline-flex items-center divide-x divide-[var(--color-border-muted)] border border-[var(--color-border-muted)]">
        <button
          type="button"
          class="px-3 py-1.5 text-sm transition-colors"
          :class="uploadMode === 'image' ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)]' : 'hover:bg-[var(--color-muted)]'"
          :aria-pressed="uploadMode === 'image'"
          @click="emit('selectMode', 'image')"
        >
          {{ t('admin.upload.sections.upload.mode.image') }}
        </button>
        <button
          type="button"
          class="px-3 py-1.5 text-sm transition-colors"
          :class="uploadMode === 'live' ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)]' : 'hover:bg-[var(--color-muted)]'"
          :aria-pressed="uploadMode === 'live'"
          @click="emit('selectMode', 'live')"
        >
          {{ t('admin.upload.sections.upload.mode.live') }}
        </button>
      </div>
      <p v-if="uploadMode === 'live'" class="text-xs text-muted">
        {{ t('admin.upload.sections.upload.liveHint') }}
      </p>
      <UFileUpload
        v-if="uploadMode === 'image'"
        :ref="setFileUploadRef"
        v-model="uploadValueModel"
        accept="image/*"
        :label="t('admin.upload.sections.upload.dropHint')"
        :description="t('admin.upload.sections.upload.supported')"
        class="w-full"
      />
      <UFileUpload
        v-else
        :ref="setVideoUploadRef"
        v-model="videoValueModel"
        accept="video/*"
        :label="t('admin.upload.sections.upload.liveDropHint')"
        :description="t('admin.upload.sections.upload.liveSupported')"
        class="w-full"
      />
    </div>
  </USection>
</template>
