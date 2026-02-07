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
  <div class="grid gap-6">
    <UCard>
      <template #header>
        <div class="space-y-1">
          <h2 class="flex items-center gap-2 text-xl font-semibold">
            <Icon name="tabler:upload" class="h-5 w-5 text-primary" />
            <span>{{ t('admin.upload.sections.upload.label') }}</span>
          </h2>
        </div>
      </template>
      <div class="space-y-4">
        <div class="flex flex-wrap items-center gap-2">
          <UButton
            size="sm"
            type="button"
            :variant="uploadMode === 'image' ? 'solid' : 'soft'"
            :color="uploadMode === 'image' ? 'primary' : 'neutral'"
            :aria-pressed="uploadMode === 'image'"
            @click="emit('selectMode', 'image')"
          >
            {{ t('admin.upload.sections.upload.mode.image') }}
          </UButton>
          <UButton
            size="sm"
            type="button"
            :variant="uploadMode === 'live' ? 'solid' : 'soft'"
            :color="uploadMode === 'live' ? 'primary' : 'neutral'"
            :aria-pressed="uploadMode === 'live'"
            @click="emit('selectMode', 'live')"
          >
            {{ t('admin.upload.sections.upload.mode.live') }}
          </UButton>
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
    </UCard>
  </div>
</template>
