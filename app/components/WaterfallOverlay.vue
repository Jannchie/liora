<script setup lang="ts">
import type { CSSProperties } from 'vue'
import type { HistogramData } from '~/types/file'
import type { FileLocation, MetadataEntry, OverlayStat, ResolvedFile } from '~/types/gallery'
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import WaterfallPreviewOverlay from './WaterfallPreviewOverlay.vue'

const {
  file,
  overlayBackgroundStyle,
  overlayImageSrc,
  overlayImageTransformStyle,
  overlayDownloadVisible,
  overlayDownloadLabel,
  overlayDownloadPercent,
  overlayZoomLabel,
  overlayZoomIndicatorVisible,
  overlayStats,
  histogram,
  metadataEntries,
  exposureEntries,
  hasMetadata,
  genreLabel,
  location,
  canEdit = false,
  viewerTouchAction = 'none',
  previewEnabled = false,
  livePhotoSharing = false,
  livePhotoPreparing = false,
  overlayImageReady = false,
} = defineProps<{
  file: ResolvedFile
  overlayBackgroundStyle: Record<string, string> | null
  overlayImageSrc: string | null
  overlayImageTransformStyle: CSSProperties
  overlayDownloadVisible: boolean
  overlayDownloadLabel: string | null
  overlayDownloadPercent: number | null
  overlayZoomLabel: string
  overlayZoomIndicatorVisible: boolean
  overlayStats: OverlayStat[]
  histogram: HistogramData | null
  metadataEntries: MetadataEntry[]
  exposureEntries: MetadataEntry[]
  hasMetadata: boolean
  genreLabel?: string | null
  location?: FileLocation | null
  canEdit?: boolean
  viewerTouchAction?: string
  previewEnabled?: boolean
  livePhotoSharing?: boolean
  livePhotoPreparing?: boolean
  overlayImageReady?: boolean
}>()

const emit = defineEmits<{
  (event: 'close'): void
  (event: 'edit'): void
  (event: 'wheel', value: WheelEvent): void
  (event: 'dblclick', value: MouseEvent): void
  (event: 'pointerdown', value: PointerEvent): void
  (event: 'pointermove', value: PointerEvent): void
  (event: 'pointerup', value: PointerEvent): void
  (event: 'pointercancel', value: PointerEvent): void
  (event: 'pointerleave', value: PointerEvent): void
  (event: 'viewerMounted', value: HTMLElement | null): void
  (event: 'shareLivePhoto'): void
}>()

const viewerRef = ref<HTMLElement | null>(null)
const videoRef = ref<HTMLVideoElement | null>(null)
const overlayHiddenClass = 'overlay-content-hidden'
const previewOpen = ref(false)
const livePhotoPlaying = ref(false)

const livePhotoVideoUrl = computed<string | null>(() => {
  const rawValue = file.metadata.livePhotoVideoUrl
  if (typeof rawValue !== 'string') {
    return null
  }
  const trimmed = rawValue.trim()
  return trimmed.length > 0 ? trimmed : null
})

const hasLivePhoto = computed<boolean>(() => Boolean(livePhotoVideoUrl.value))

const previewImageSrc = computed<string | null>(() => {
  const candidates = [
    file.imageUrl,
    overlayImageSrc,
    file.previewUrl,
    file.coverUrl,
  ]
  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim()
      if (trimmed.length > 0) {
        return trimmed
      }
    }
  }
  return null
})

const displayImageUrl = computed<string>(() => {
  const candidates = [
    overlayImageSrc,
    file.previewUrl,
    file.coverUrl,
    file.imageUrl,
  ]
  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim()
      if (trimmed.length > 0) {
        return trimmed
      }
    }
  }
  return ''
})

const depthMapUrl = computed<string>(() => {
  const raw = file.metadata.depthMapUrl
  if (typeof raw !== 'string') {
    return ''
  }
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : ''
})

const placeholderUrl = computed<string>(() => {
  const raw = file.placeholder
  if (typeof raw !== 'string') {
    return ''
  }
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : ''
})

const shouldAutoPlay = computed(() => overlayImageReady && !livePhotoPlaying.value)

const { t } = useI18n()

const canOpenPreview = computed(() => previewEnabled && Boolean(previewImageSrc.value))
const livePhotoLabel = computed(() => (livePhotoPlaying.value ? t('gallery.livePhoto.still') : t('gallery.livePhoto.play')))

const WaterfallHistogramPanel = defineAsyncComponent(() => import('~/components/WaterfallHistogramPanel.vue'))
const WaterfallLocationMap = defineAsyncComponent(() => import('~/components/WaterfallLocationMap.vue'))

watch(
  viewerRef,
  (next) => {
    emit('viewerMounted', next)
  },
  { immediate: true },
)

watch(
  () => file.id,
  () => {
    previewOpen.value = false
    livePhotoPlaying.value = false
    if (hasLivePhoto.value) {
      void nextTick(() => {
        if (hasLivePhoto.value) {
          livePhotoPlaying.value = true
        }
      })
    }
  },
  { immediate: true },
)

watch(
  () => previewEnabled,
  (enabled) => {
    if (!enabled) {
      previewOpen.value = false
    }
  },
)

watch(
  hasLivePhoto,
  (next) => {
    if (next) {
      livePhotoPlaying.value = true
      return
    }
    livePhotoPlaying.value = false
    if (videoRef.value) {
      videoRef.value.pause()
      videoRef.value.currentTime = 0
    }
  },
)

watch(
  livePhotoPlaying,
  (playing) => {
    const video = videoRef.value
    if (!video) {
      return
    }
    if (!playing) {
      video.pause()
      video.currentTime = 0
      return
    }
    video.currentTime = 0
    const playPromise = video.play()
    if (playPromise) {
      playPromise.catch(() => {
        livePhotoPlaying.value = false
      })
    }
  },
)

watch(
  videoRef,
  (video) => {
    if (!video || !livePhotoPlaying.value) {
      return
    }
    video.currentTime = 0
    const playPromise = video.play()
    if (playPromise) {
      playPromise.catch(() => {
        livePhotoPlaying.value = false
      })
    }
  },
)

onBeforeUnmount(() => {
  emit('viewerMounted', null)
  if (typeof document !== 'undefined') {
    const root = document.documentElement
    if (root.classList.contains(overlayHiddenClass)) {
      root.classList.remove(overlayHiddenClass)
    }
    if (document.body.classList.contains(overlayHiddenClass)) {
      document.body.classList.remove(overlayHiddenClass)
    }
  }
})

onMounted(() => {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.add(overlayHiddenClass)
    document.body.classList.add(overlayHiddenClass)
  }
})

function openPreview(): void {
  if (!canOpenPreview.value) {
    return
  }
  previewOpen.value = true
}

function toggleLivePhoto(): void {
  if (!hasLivePhoto.value) {
    return
  }
  livePhotoPlaying.value = !livePhotoPlaying.value
}

function handleLivePhotoEnded(): void {
  livePhotoPlaying.value = false
}
</script>

<template>
  <div
    class="fixed inset-0 z-50 overlay-root"
    role="dialog"
    aria-modal="true"
    :aria-labelledby="`overlay-title-${file.id}`"
  >
    <div
      v-if="overlayBackgroundStyle"
      class="pointer-events-none absolute inset-0 scale-110 bg-cover bg-center blur-3xl"
      :style="overlayBackgroundStyle"
      aria-hidden="true"
    />
    <div class="absolute inset-0" @click="emit('close')" />
    <div class="relative flex h-full w-full overlay-safe-area">
      <div class="relative z-10 flex h-full w-full flex-col gap-4 overflow-y-auto bg-default text-default backdrop-blur md:grid md:grid-cols-[minmax(0,2fr)_minmax(300px,380px)] md:gap-0 md:overflow-y-visible">
        <div
          ref="viewerRef"
          class="relative flex max-h-[calc(100dvh-100px)] w-full shrink-0 items-center justify-center overflow-hidden bg-black md:h-full md:max-h-dvh"
          :style="{ touchAction: viewerTouchAction }"
          @wheel.prevent="emit('wheel', $event)"
          @dblclick.prevent="emit('dblclick', $event)"
          @pointerdown="emit('pointerdown', $event)"
          @pointermove="emit('pointermove', $event)"
          @pointerup="emit('pointerup', $event)"
          @pointercancel="emit('pointercancel', $event)"
          @pointerleave="emit('pointerleave', $event)"
        >
          <video
            v-if="hasLivePhoto"
            v-show="livePhotoPlaying"
            ref="videoRef"
            :key="`live-${file.id}`"
            :src="livePhotoVideoUrl || undefined"
            :poster="overlayImageSrc || file.previewUrl || file.coverUrl || file.imageUrl"
            :width="file.width"
            :height="file.height"
            :style="overlayImageTransformStyle"
            class="h-auto w-full select-none object-contain md:max-h-screen"
            muted
            playsinline
            preload="metadata"
            @ended="handleLivePhotoEnded"
          />
          <DepthMapViewer
            v-show="!livePhotoPlaying || !hasLivePhoto"
            :key="file.id"
            :image-url="displayImageUrl"
            :depth-url="depthMapUrl"
            :placeholder-url="placeholderUrl"
            :placeholder-aspect-ratio="file.placeholderAspectRatio"
            :image-width="file.width"
            :image-height="file.height"
            :auto-play="shouldAutoPlay"
            :style="overlayImageTransformStyle"
            class="w-full select-none bg-transparent rounded-none"
            :class="[
              canOpenPreview ? 'cursor-zoom-in' : undefined,
            ]"
            @click="openPreview"
          />
          <button
            v-if="hasLivePhoto"
            type="button"
            class="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/10"
            :aria-pressed="livePhotoPlaying"
            @click="toggleLivePhoto"
          >
            <Icon :name="livePhotoPlaying ? 'tabler:photo' : 'tabler:player-play'" class="h-4 w-4" />
            <span>{{ livePhotoLabel }}</span>
          </button>
          <Transition
            appear
            enter-active-class="transition duration-200 ease-out"
            leave-active-class="transition duration-200 ease-in"
            enter-from-class="opacity-0 translate-y-1"
            enter-to-class="opacity-100 translate-y-0"
            leave-from-class="opacity-100 translate-y-0"
            leave-to-class="opacity-0 translate-y-1"
          >
            <OverlayDownloadBadge
              v-if="overlayDownloadVisible"
              :visible="true"
              :label="overlayDownloadLabel"
              :percent="overlayDownloadPercent"
            />
          </Transition>
          <Transition
            appear
            enter-active-class="transition duration-150 ease-out"
            leave-active-class="transition duration-150 ease-in"
            enter-from-class="opacity-0 translate-y-1"
            enter-to-class="opacity-100 translate-y-0"
            leave-from-class="opacity-100 translate-y-0"
            leave-to-class="opacity-0 translate-y-1"
          >
            <div
              v-if="overlayZoomIndicatorVisible"
              class="home-display-font pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-md bg-black/70 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/10 backdrop-blur"
            >
              {{ overlayZoomLabel }}
            </div>
          </Transition>
        </div>
        <div class="home-display-font flex min-h-0 flex-col gap-4 p-3 md:border-l md:border-default/20 md:p-4 md:overflow-y-auto">
          <div class="space-y-2.5">
            <div class="flex items-start justify-between gap-3">
              <div class="space-y-1">
                <h3 :id="`overlay-title-${file.id}`" class="text-lg font-semibold leading-snug text-highlighted">
                  {{ file.displayTitle }}
                </h3>
              </div>
              <div class="flex items-center gap-2">
                <UButton
                  type="button"
                  size="md"
                  color="neutral"
                  variant="ghost"
                  icon="tabler:x"
                  :aria-label="t('common.actions.close')"
                  @click="emit('close')"
                />
              </div>
            </div>
            <div class="flex flex-wrap items-center gap-2 text-xs font-medium text-muted">
              <div
                v-for="stat in overlayStats"
                :key="`${stat.icon}-${stat.label}`"
                class="inline-flex items-center gap-1 rounded bg-elevated/80 px-2 py-1 text-highlighted ring-1 ring-default/30"
              >
                <Icon :name="stat.icon" class="h-3.5 w-3.5" />
                <span class="leading-none">{{ stat.label }}</span>
              </div>
            </div>
            <div v-if="genreLabel" class="flex items-center gap-2">
              <span class="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-1 text-xs font-semibold text-primary ring-1 ring-primary/20">
                <Icon name="tabler:tag" class="h-3.5 w-3.5" />
                <span>{{ genreLabel }}</span>
              </span>
            </div>
          </div>
          <div class="space-y-3">
            <Suspense>
              <template #default>
                <WaterfallHistogramPanel :histogram="histogram" />
              </template>
              <template #fallback>
                <div class="rounded-lg border border-default/20 bg-elevated/80" aria-hidden="true">
                  <div class="flex items-center justify-between border-b border-default/10 px-3 py-2 text-xs uppercase tracking-wide text-muted">
                    <div class="flex items-center gap-2">
                      <div class="h-4 w-4 rounded bg-default/40" />
                      <div class="h-4 w-24 rounded bg-default/40" />
                    </div>
                  </div>
                  <div class="space-y-3 p-3">
                    <div class="relative h-36 w-full overflow-hidden rounded-md bg-default/60 ring-1 ring-default/10">
                      <div class="absolute inset-0 animate-pulse bg-default/40" />
                    </div>
                    <div class="grid grid-cols-3 gap-2 text-xs">
                      <div class="space-y-1">
                        <div class="flex items-center justify-between">
                          <div class="h-4 w-12 rounded bg-default/40" />
                          <div class="h-4 w-8 rounded bg-default/40" />
                        </div>
                        <div class="h-px w-full overflow-hidden rounded-full bg-default/40">
                          <div class="h-full w-1/2 rounded-full bg-default/50" />
                        </div>
                      </div>
                      <div class="space-y-1">
                        <div class="flex items-center justify-between">
                          <div class="h-4 w-12 rounded bg-default/40" />
                          <div class="h-4 w-8 rounded bg-default/40" />
                        </div>
                        <div class="h-px w-full overflow-hidden rounded-full bg-default/40">
                          <div class="h-full w-1/2 rounded-full bg-default/50" />
                        </div>
                      </div>
                      <div class="space-y-1">
                        <div class="flex items-center justify-between">
                          <div class="h-4 w-12 rounded bg-default/40" />
                          <div class="h-4 w-8 rounded bg-default/40" />
                        </div>
                        <div class="h-px w-full overflow-hidden rounded-full bg-default/40">
                          <div class="h-full w-1/2 rounded-full bg-default/50" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </template>
            </Suspense>
            <WaterfallLocationMap v-if="location" :location="location" />
            <WaterfallMetadataPanel
              :metadata-entries="metadataEntries"
              :exposure-entries="exposureEntries"
              :has-metadata="hasMetadata"
            />
          </div>
          <div
            v-if="canEdit || hasLivePhoto"
            class="mt-auto border-t border-default/10 pt-3"
          >
            <div class="flex flex-wrap gap-2">
              <UButton
                v-if="canEdit"
                type="button"
                icon="tabler:settings"
                size="md"
                variant="soft"
                @click="emit('edit')"
              >
                {{ t('common.actions.edit') }}
              </UButton>
              <UButton
                v-if="hasLivePhoto"
                type="button"
                icon="tabler:share"
                size="md"
                variant="soft"
                color="primary"
                :loading="livePhotoPreparing || livePhotoSharing"
                :disabled="livePhotoSharing"
                @click="emit('shareLivePhoto')"
              >
                {{ t('gallery.livePhoto.share') }}
              </UButton>
            </div>
          </div>
        </div>
      </div>
    </div>
    <WaterfallPreviewOverlay
      v-model:open="previewOpen"
      :src="previewImageSrc"
      :alt="file.displayTitle"
      :width="file.width"
      :height="file.height"
      :aria-label="t('gallery.viewLarge', { title: file.displayTitle })"
    />
  </div>
</template>

<style scoped>
.overlay-root {
  width: 100vw;
  height: 100vh;
  height: -webkit-fill-available;
  height: 100dvh;
  overscroll-behavior: contain;
}

.overlay-safe-area {
  padding-top: env(safe-area-inset-top);
  padding-right: env(safe-area-inset-right);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
}

:global(.overlay-content-hidden #__nuxt) {
  visibility: hidden;
  pointer-events: none;
}

:global(html.overlay-content-hidden),
:global(body.overlay-content-hidden),
:global(html.overlay-content-hidden body) {
  overflow: hidden;
}
</style>
