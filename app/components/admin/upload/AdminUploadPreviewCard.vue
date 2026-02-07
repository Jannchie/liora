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
  <UCard class="border border-default/50 bg-elevated/80">
    <template #header>
      <div class="flex items-center justify-between gap-2">
        <div class="space-y-0.5">
          <p class="text-xs font-semibold uppercase tracking-wide text-muted">
            {{ t('admin.upload.sections.preview.title') }}
          </p>
        </div>
        <UButton
          variant="ghost"
          color="neutral"
          type="button"
          icon="tabler:camera-rotate"
          @click="emit('openFileDialog')"
        >
          {{ props.changePrimaryLabel }}
        </UButton>
      </div>
    </template>
    <div class="space-y-4">
      <div class="space-y-3">
        <div
          class="flex w-full cursor-pointer items-center justify-center rounded-xl border border-default/50 bg-black/10 outline-none ring-primary/40 focus-visible:ring-2"
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
      </div>
      <div
        v-if="props.hasSelectedFile"
        class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-default/50 bg-default/80 px-3 py-2 text-sm"
      >
        <div class="flex items-center gap-2">
          <Icon name="tabler:photo" class="h-4 w-4 text-primary" />
          <span class="font-semibold text-highlighted">
            {{ props.selectedFileName }}
          </span>
        </div>
        <div class="flex items-center gap-2 text-xs text-muted">
          <Icon name="tabler:info-circle" class="h-4 w-4" />
          <span>{{ props.selectedFileType || 'image' }}</span>
        </div>
      </div>
      <div
        v-if="props.hasSelectedVideo"
        class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-default/50 bg-default/80 px-3 py-2 text-sm"
      >
        <div class="flex items-center gap-2">
          <Icon name="tabler:movie" class="h-4 w-4 text-primary" />
          <span class="font-semibold text-highlighted">
            {{ props.selectedVideoName }}
          </span>
        </div>
        <div class="flex items-center gap-2 text-xs text-muted">
          <Icon name="tabler:info-circle" class="h-4 w-4" />
          <span>{{ props.selectedVideoType || 'video' }}</span>
        </div>
      </div>
      <div
        v-if="props.hasSelectedVideo"
        class="space-y-3 rounded-lg border border-default/50 bg-default/80 px-3 py-3"
      >
        <div class="flex items-center justify-between gap-2 text-xs text-muted">
          <div class="flex items-center gap-2">
            <Icon name="tabler:movie" class="h-4 w-4 text-primary" />
            <span class="font-semibold text-highlighted">
              {{ t('admin.upload.sections.livePhoto.title') }}
            </span>
          </div>
          <span>{{ props.liveFrameDurationLabel }}</span>
        </div>
        <video
          :ref="props.setVideoElementRef"
          :src="props.videoPreviewUrl"
          :poster="props.previewUrl || undefined"
          class="w-full max-h-64 rounded-lg border border-default/50 bg-black/10 object-contain"
          muted
          playsinline
          preload="metadata"
          @loadedmetadata="emit('videoMetadataLoaded')"
          @error="emit('videoError')"
        />
        <div class="flex items-center gap-2 text-xs text-muted">
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
          <span class="tabular-nums">{{ props.liveFrameDurationLabel }}</span>
        </div>
        <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span>{{ t('admin.upload.sections.livePhoto.frameHint') }}</span>
          <UButton
            size="sm"
            type="button"
            color="primary"
            variant="soft"
            :loading="props.liveFramePending"
            :disabled="props.liveFrameDuration <= 0"
            @click="emit('captureLiveFrame')"
          >
            {{ t('admin.upload.sections.livePhoto.useFrame') }}
          </UButton>
        </div>
      </div>
      <div
        v-if="props.isUploading"
        class="space-y-2 rounded-lg border border-default/50 bg-default/80 px-3 py-3"
      >
        <div class="flex items-center justify-between gap-2 text-sm">
          <div class="flex items-center gap-2">
            <Icon name="tabler:cloud-upload" class="h-4 w-4 text-primary" />
            <span class="font-semibold text-highlighted">
              {{ t('admin.upload.sections.progress.title') }}
            </span>
          </div>
          <span class="text-xs text-muted">
            {{ props.uploadProgressPercent.toFixed(1) }}%
          </span>
        </div>
        <div class="h-2 w-full overflow-hidden rounded-full bg-default/50">
          <div
            class="h-full bg-primary transition-all"
            :style="{ width: `${props.uploadProgressPercent}%` }"
          />
        </div>
        <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span class="flex items-center gap-1">
            <Icon name="tabler:database-export" class="h-4 w-4" />
            <span>{{ t('admin.upload.sections.progress.uploaded') }}:</span>
            <span class="text-highlighted">{{ props.uploadedBytesText }}</span>
            <span v-if="props.uploadTotalBytes">/ {{ props.uploadTotalText }}</span>
          </span>
          <span class="flex items-center gap-1">
            <Icon name="tabler:gauge" class="h-4 w-4" />
            <span>{{ t('admin.upload.sections.progress.speed') }}:</span>
            <span class="text-highlighted">{{ props.uploadSpeedText }}</span>
          </span>
        </div>
        <p class="text-[11px] text-muted">
          {{ t('admin.upload.sections.progress.total') }}: {{ props.uploadTotalText }}
        </p>
      </div>
    </div>
  </UCard>
</template>
