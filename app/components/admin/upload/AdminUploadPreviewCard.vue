<script setup lang="ts">
const props = defineProps<{
  previewMaxHeight: number
  aspectRatioStyle: string
  changePrimaryLabel: string
  previewUrl: string
  isLiveMode: boolean
  selectedFileName: string
  selectedFileType: string
  hasSelectedFile: boolean
  selectedVideoName: string
  selectedVideoType: string
  hasSelectedVideo: boolean
  videoPreviewUrl: string
  liveFrameDurationLabel: string
  liveFrameTimeLabel: string
  liveFrameDuration: number
  liveFrameTime: number
  liveFramePending: boolean
  isUploading: boolean
  uploadProgressPercent: number
  uploadedBytesText: string
  uploadTotalBytes: number
  uploadTotalText: string
  uploadSpeedText: string
  setVideoElementRef: (instance: unknown) => void
}>()

const emit = defineEmits<{
  openFileDialog: []
  videoMetadataLoaded: []
  videoError: []
  frameInput: [event: Event]
  captureLiveFrame: []
}>()

const { t } = useI18n()
</script>

<template>
  <USection
    :label="t('admin.upload.sections.preview.title')"
    icon="tabler:photo"
  >
    <template #actions>
      <UButton
        variant="ghost"
        color="neutral"
        size="sm"
        type="button"
        icon="tabler:camera-rotate"
        @click="emit('openFileDialog')"
      >
        {{ props.changePrimaryLabel }}
      </UButton>
    </template>
    <div class="space-y-4">
      <div
        class="flex w-full cursor-pointer items-center justify-center bg-muted outline-none ring-primary/40 focus-visible:ring-2"
        :style="{ aspectRatio: props.aspectRatioStyle, maxHeight: `${props.previewMaxHeight}px` }"
        role="button"
        tabindex="0"
        :aria-label="props.changePrimaryLabel"
        @click="emit('openFileDialog')"
        @keydown.enter.prevent="emit('openFileDialog')"
        @keydown.space.prevent="emit('openFileDialog')"
      >
        <img
          v-if="props.previewUrl"
          :src="props.previewUrl"
          :alt="t('admin.upload.sections.preview.alt')"
          class="max-h-full max-w-full object-contain"
          :style="{ maxHeight: `${props.previewMaxHeight}px` }"
        >
        <div
          v-else-if="props.isLiveMode && props.hasSelectedVideo"
          class="px-6 text-center text-xs text-muted"
        >
          {{ t('admin.upload.sections.livePhoto.framePlaceholder') }}
        </div>
      </div>

      <dl
        v-if="props.hasSelectedFile || props.hasSelectedVideo"
        class="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 font-mono text-[11px]"
      >
        <template v-if="props.hasSelectedFile">
          <dt class="text-muted">
            image
          </dt>
          <dd class="truncate text-highlighted">
            {{ props.selectedFileName }} <span class="text-muted">· {{ props.selectedFileType || 'image' }}</span>
          </dd>
        </template>
        <template v-if="props.hasSelectedVideo">
          <dt class="text-muted">
            video
          </dt>
          <dd class="truncate text-highlighted">
            {{ props.selectedVideoName }} <span class="text-muted">· {{ props.selectedVideoType || 'video' }}</span>
          </dd>
        </template>
      </dl>

      <div v-if="props.hasSelectedVideo" class="space-y-3 border-t border-border-muted pt-4">
        <p class="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
          {{ t('admin.upload.sections.livePhoto.title') }}
        </p>
        <video
          :ref="props.setVideoElementRef"
          :src="props.videoPreviewUrl"
          :poster="props.previewUrl || undefined"
          class="max-h-64 w-full bg-muted object-contain"
          muted
          playsinline
          preload="metadata"
          @loadedmetadata="emit('videoMetadataLoaded')"
          @error="emit('videoError')"
        />
        <div class="flex items-center gap-2 font-mono text-[11px]">
          <span class="tabular-nums text-highlighted">{{ props.liveFrameTimeLabel }}</span>
          <input
            type="range"
            min="0"
            :max="props.liveFrameDuration"
            step="0.1"
            :value="props.liveFrameTime"
            class="h-1 w-full cursor-pointer accent-primary"
            :disabled="props.liveFrameDuration <= 0"
            @input="event => emit('frameInput', event)"
          >
          <span class="tabular-nums text-muted">{{ props.liveFrameDurationLabel }}</span>
        </div>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="text-xs text-muted">{{ t('admin.upload.sections.livePhoto.frameHint') }}</span>
          <UButton
            size="sm"
            type="button"
            color="primary"
            variant="ghost"
            :loading="props.liveFramePending"
            :disabled="props.liveFrameDuration <= 0"
            @click="emit('captureLiveFrame')"
          >
            {{ t('admin.upload.sections.livePhoto.useFrame') }}
          </UButton>
        </div>
      </div>

      <div v-if="props.isUploading" class="space-y-2 border-t border-border-muted pt-4">
        <div class="flex items-center justify-between gap-2 text-[11px] uppercase tracking-[0.12em] text-muted">
          <span>{{ t('admin.upload.sections.progress.title') }}</span>
          <span class="font-mono normal-case">{{ props.uploadProgressPercent.toFixed(1) }}%</span>
        </div>
        <div class="h-px w-full overflow-hidden bg-border-muted">
          <div
            class="h-full bg-primary transition-all"
            :style="{ width: `${props.uploadProgressPercent}%` }"
          />
        </div>
        <div class="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-muted">
          <span>
            <span class="text-highlighted">{{ props.uploadedBytesText }}</span>
            <span v-if="props.uploadTotalBytes"> / {{ props.uploadTotalText }}</span>
          </span>
          <span class="text-highlighted">{{ props.uploadSpeedText }}</span>
        </div>
      </div>
    </div>
  </USection>
</template>
