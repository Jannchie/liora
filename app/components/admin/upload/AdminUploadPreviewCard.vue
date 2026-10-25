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
  <div class="space-y-4">
    <div class="flex min-h-7 items-center justify-between gap-3">
      <p class="label-caption flex items-center gap-2">
        <Icon name="jannchie:image" class="h-3.5 w-3.5" />
        <span>{{ t('admin.upload.sections.preview.title') }}</span>
      </p>
      <UButton
        variant="ghost"
        color="neutral"
        size="sm"
        type="button"
        icon="jannchie:camera-rotate"
        @click="emit('openFileDialog')"
      >
        {{ props.changePrimaryLabel }}
      </UButton>
    </div>

    <!-- Sunken well framed by a hairline; the photo itself stays square. -->
    <div
      class="flex w-full cursor-pointer items-center justify-center overflow-hidden border border-border bg-muted outline-none transition-colors hover:border-border-strong focus-visible:border-primary"
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
        class="px-6 text-center text-[13px] text-dimmed"
      >
        {{ t('admin.upload.sections.livePhoto.framePlaceholder') }}
      </div>
    </div>

    <dl
      v-if="props.hasSelectedFile || props.hasSelectedVideo"
      class="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-1 font-mono text-[11px] num-tabular"
    >
      <template v-if="props.hasSelectedFile">
        <dt class="label-caption-sm">
          image
        </dt>
        <dd class="truncate text-highlighted">
          {{ props.selectedFileName }} <span class="text-dimmed">· {{ props.selectedFileType || 'image' }}</span>
        </dd>
      </template>
      <template v-if="props.hasSelectedVideo">
        <dt class="label-caption-sm">
          video
        </dt>
        <dd class="truncate text-highlighted">
          {{ props.selectedVideoName }} <span class="text-dimmed">· {{ props.selectedVideoType || 'video' }}</span>
        </dd>
      </template>
    </dl>

    <!-- Live Photo frame picker and upload progress are sub-groups of
         the same column: a full-width hairline opens each one. -->
    <div v-if="props.hasSelectedVideo" class="space-y-3 border-t border-border pt-4">
      <p class="label-caption">
        {{ t('admin.upload.sections.livePhoto.title') }}
      </p>
      <video
        :ref="props.setVideoElementRef"
        :src="props.videoPreviewUrl"
        :poster="props.previewUrl || undefined"
        class="max-h-64 w-full border border-border bg-muted object-contain"
        muted
        playsinline
        preload="metadata"
        @loadedmetadata="emit('videoMetadataLoaded')"
        @error="emit('videoError')"
      />
      <div class="flex items-center gap-3 text-[11px] num-tabular">
        <span class="text-highlighted">{{ props.liveFrameTimeLabel }}</span>
        <input
          type="range"
          min="0"
          :max="props.liveFrameDuration"
          step="0.1"
          :value="props.liveFrameTime"
          class="frame-slider w-full"
          :style="{ '--p': `${props.liveFrameDuration > 0 ? (props.liveFrameTime / props.liveFrameDuration) * 100 : 0}%` }"
          :disabled="props.liveFrameDuration <= 0"
          @input="event => emit('frameInput', event)"
        >
        <span class="text-dimmed">{{ props.liveFrameDurationLabel }}</span>
      </div>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <span class="text-[13px] text-dimmed">{{ t('admin.upload.sections.livePhoto.frameHint') }}</span>
        <UButton
          size="sm"
          type="button"
          color="neutral"
          variant="outline"
          :loading="props.liveFramePending"
          :disabled="props.liveFrameDuration <= 0"
          @click="emit('captureLiveFrame')"
        >
          {{ t('admin.upload.sections.livePhoto.useFrame') }}
        </UButton>
      </div>
    </div>

    <div v-if="props.isUploading" class="space-y-2.5 border-t border-border pt-4">
      <div class="flex items-center justify-between gap-2 label-caption">
        <span>{{ t('admin.upload.sections.progress.title') }}</span>
        <span class="text-highlighted num-tabular">{{ props.uploadProgressPercent.toFixed(1) }}%</span>
      </div>
      <!-- 2px ink fill on a border-strong track, like the icons site's slider. -->
      <div class="h-0.5 w-full overflow-hidden bg-border-strong">
        <div
          class="h-full bg-primary transition-[width]"
          :style="{ width: `${props.uploadProgressPercent}%` }"
        />
      </div>
      <div class="flex flex-wrap items-center justify-between gap-2 text-[11px] text-dimmed num-tabular">
        <span>
          <span class="text-highlighted">{{ props.uploadedBytesText }}</span>
          <span v-if="props.uploadTotalBytes"> / {{ props.uploadTotalText }}</span>
        </span>
        <span class="text-highlighted">{{ props.uploadSpeedText }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Frame scrubber: a 2px track, the played part in ink, a small solid
   dot for the thumb — the same slider as the icons site. */
.frame-slider {
  height: 20px;
  margin: 0;
  padding: 0;
  background: none;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
}
.frame-slider:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
.frame-slider:focus-visible {
  outline: none;
}
.frame-slider::-webkit-slider-runnable-track {
  height: 2px;
  border-radius: 1px;
  background:
    linear-gradient(var(--color-primary), var(--color-primary)) 0 / var(--p, 0%) 100% no-repeat,
    var(--color-border-strong);
}
.frame-slider::-moz-range-track {
  height: 2px;
  border-radius: 1px;
  background: var(--color-border-strong);
}
.frame-slider::-moz-range-progress {
  height: 2px;
  border-radius: 1px;
  background: var(--color-primary);
}
.frame-slider::-webkit-slider-thumb {
  width: 10px;
  height: 10px;
  margin-top: -4px;
  border: 0;
  border-radius: 50%;
  background: var(--color-primary);
  -webkit-appearance: none;
  appearance: none;
}
.frame-slider::-moz-range-thumb {
  width: 10px;
  height: 10px;
  border: 0;
  border-radius: 50%;
  background: var(--color-primary);
}
.frame-slider:focus-visible::-webkit-slider-thumb {
  outline: 2px solid var(--color-border-strong);
  outline-offset: 2px;
}
.frame-slider:focus-visible::-moz-range-thumb {
  outline: 2px solid var(--color-border-strong);
  outline-offset: 2px;
}
</style>
