<script setup lang="ts">
import type { CSSProperties } from 'vue'
import type { HistogramData } from '~/types/file'
import type { FileLocation, LightroomRecipeView, MetadataEntry, OverlayStat, ResolvedFile } from '~/types/gallery'
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import WaterfallPreviewOverlay from './WaterfallPreviewOverlay.vue'

const {
  file,
  overlayBackgroundStyle,
  overlayImageSrc,
  overlayImageFitStyle,
  overlayImageTransformStyle,
  overlayDownloadVisible,
  overlayDownloadLabel,
  overlayDownloadPercent,
  overlayZoomLabel,
  overlayZoomIndicatorVisible,
  overlayStats,
  histogram,
  metadataEntries,
  focusEntry,
  cropEntry,
  lightroomRecipe,
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
  previewImageSrc = null,
} = defineProps<{
  file: ResolvedFile
  overlayBackgroundStyle: Record<string, string> | null
  overlayImageSrc: string | null
  overlayImageFitStyle: CSSProperties
  overlayImageTransformStyle: CSSProperties
  overlayDownloadVisible: boolean
  overlayDownloadLabel: string | null
  overlayDownloadPercent: number | null
  overlayZoomLabel: string
  overlayZoomIndicatorVisible: boolean
  overlayStats: OverlayStat[]
  histogram: HistogramData | null
  metadataEntries: MetadataEntry[]
  focusEntry: MetadataEntry | null
  cropEntry: MetadataEntry | null
  lightroomRecipe: LightroomRecipeView | null
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
  previewImageSrc?: string | null
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
const focusBoxPinned = ref(false)
const focusBoxHovered = ref(false)

const livePhotoVideoUrl = computed<string | undefined>(() => {
  const rawValue = file.metadata.livePhotoVideoUrl
  if (typeof rawValue !== 'string') {
    return
  }
  const trimmed = rawValue.trim()
  return trimmed.length > 0 ? trimmed : undefined
})

const hasLivePhoto = computed<boolean>(() => Boolean(livePhotoVideoUrl.value))

const resolvedPreviewImageSrc = computed<string | null>(() => {
  if (typeof previewImageSrc === 'string') {
    const trimmed = previewImageSrc.trim()
    if (trimmed.length > 0) {
      return trimmed
    }
  }
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

interface FocusPoint {
  x: number
  y: number
}

interface FocusBoxRect {
  left: number
  top: number
  width: number
  height: number
}

function parseNumbers(value: string | undefined): number[] {
  if (!value) {
    return []
  }
  const matches = value.match(/-?\d+(?:\.\d+)?/g)
  if (!matches) {
    return []
  }
  return matches
    .map(Number)
    .filter(number => Number.isFinite(number))
}

function parseMetadataNumber(value: string | undefined): number | null {
  if (!value) {
    return null
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function parseUprightTransform(value: string | undefined): number[] | null {
  const numbers = parseNumbers(value)
  if (numbers.length < 9) {
    return null
  }
  return numbers.slice(0, 9)
}

function rotateAroundCenter(point: FocusPoint, angleDegrees: number): FocusPoint {
  const radians = angleDegrees * Math.PI / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const dx = point.x - 0.5
  const dy = point.y - 0.5
  return {
    x: 0.5 + dx * cos - dy * sin,
    y: 0.5 + dx * sin + dy * cos,
  }
}

function applyHomography(point: FocusPoint, matrix: number[]): FocusPoint | null {
  const m0 = matrix[0]
  const m1 = matrix[1]
  const m2 = matrix[2]
  const m3 = matrix[3]
  const m4 = matrix[4]
  const m5 = matrix[5]
  const m6 = matrix[6]
  const m7 = matrix[7]
  const m8 = matrix[8]
  if (
    m0 === undefined
    || m1 === undefined
    || m2 === undefined
    || m3 === undefined
    || m4 === undefined
    || m5 === undefined
    || m6 === undefined
    || m7 === undefined
    || m8 === undefined
  ) {
    return null
  }
  const denominator = m6 * point.x + m7 * point.y + m8
  if (!Number.isFinite(denominator) || Math.abs(denominator) < 1e-8) {
    return null
  }
  const x = (m0 * point.x + m1 * point.y + m2) / denominator
  const y = (m3 * point.x + m4 * point.y + m5) / denominator
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null
  }
  return { x, y }
}

function applyPerspectiveApproximation(
  point: FocusPoint,
  perspectiveHorizontal: number,
  perspectiveVertical: number,
  perspectiveRotate: number,
  perspectiveScale: number,
): FocusPoint {
  let next = { ...point }
  if (Math.abs(perspectiveHorizontal) > 1e-6) {
    next.x += (perspectiveHorizontal / 100) * (next.y - 0.5)
  }
  if (Math.abs(perspectiveVertical) > 1e-6) {
    next.y += (perspectiveVertical / 100) * (next.x - 0.5)
  }
  if (Math.abs(perspectiveRotate) > 1e-6) {
    next = rotateAroundCenter(next, perspectiveRotate)
  }
  if (Math.abs(perspectiveScale - 100) > 1e-6 && perspectiveScale > 0) {
    const scale = perspectiveScale / 100
    next = {
      x: 0.5 + (next.x - 0.5) * scale,
      y: 0.5 + (next.y - 0.5) * scale,
    }
  }
  return next
}

function applyCrop(point: FocusPoint, cropLeft: number, cropTop: number, cropRight: number, cropBottom: number): FocusPoint {
  const cropWidth = cropRight - cropLeft
  const cropHeight = cropBottom - cropTop
  if (cropWidth <= 0 || cropHeight <= 0) {
    return point
  }
  return {
    x: (point.x - cropLeft) / cropWidth,
    y: (point.y - cropTop) / cropHeight,
  }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

const transformedFocusBox = computed<FocusBoxRect | null>(() => {
  const metadata = file.metadata
  const focusLocationValues = parseNumbers(metadata.focusLocation)
  if (focusLocationValues.length < 4) {
    return null
  }
  const sourceWidth = focusLocationValues[0] ?? 0
  const sourceHeight = focusLocationValues[1] ?? 0
  const centerX = focusLocationValues[2] ?? 0
  const centerY = focusLocationValues[3] ?? 0
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    return null
  }

  const frameSizeValues = parseNumbers(metadata.focusFrameSize)
  if (frameSizeValues.length < 2) {
    return null
  }
  const frameWidth = frameSizeValues[0] ?? 0
  const frameHeight = frameSizeValues[1] ?? 0
  if (frameWidth <= 0 || frameHeight <= 0) {
    return null
  }

  const halfFrameWidth = frameWidth / 2
  const halfFrameHeight = frameHeight / 2
  const corners: FocusPoint[] = [
    { x: (centerX - halfFrameWidth) / sourceWidth, y: (centerY - halfFrameHeight) / sourceHeight },
    { x: (centerX + halfFrameWidth) / sourceWidth, y: (centerY - halfFrameHeight) / sourceHeight },
    { x: (centerX + halfFrameWidth) / sourceWidth, y: (centerY + halfFrameHeight) / sourceHeight },
    { x: (centerX - halfFrameWidth) / sourceWidth, y: (centerY + halfFrameHeight) / sourceHeight },
  ]

  const matrix = parseUprightTransform(metadata.uprightTransform)
  const perspectiveHorizontal = parseMetadataNumber(metadata.perspectiveHorizontal) ?? 0
  const perspectiveVertical = parseMetadataNumber(metadata.perspectiveVertical) ?? 0
  const perspectiveRotate = parseMetadataNumber(metadata.perspectiveRotate) ?? 0
  const perspectiveScale = parseMetadataNumber(metadata.perspectiveScale) ?? 100
  const cropLeft = parseMetadataNumber(metadata.cropLeft)
  const cropTop = parseMetadataNumber(metadata.cropTop)
  const cropRight = parseMetadataNumber(metadata.cropRight)
  const cropBottom = parseMetadataNumber(metadata.cropBottom)
  const cropAngle = parseMetadataNumber(metadata.cropAngle) ?? 0

  const transformed = corners
    .map((corner) => {
      let next: FocusPoint | null = matrix
        ? applyHomography(corner, matrix)
        : applyPerspectiveApproximation(
            corner,
            perspectiveHorizontal,
            perspectiveVertical,
            perspectiveRotate,
            perspectiveScale,
          )
      if (!next) {
        return null
      }
      if (Math.abs(cropAngle) > 1e-6) {
        next = rotateAroundCenter(next, cropAngle)
      }
      if (cropLeft !== null && cropTop !== null && cropRight !== null && cropBottom !== null) {
        next = applyCrop(next, cropLeft, cropTop, cropRight, cropBottom)
      }
      return next
    })
    .filter((point): point is FocusPoint => point !== null)

  if (transformed.length !== 4) {
    return null
  }

  const xs = transformed.map(point => point.x)
  const ys = transformed.map(point => point.y)
  const left = clamp01(Math.min(...xs))
  const right = clamp01(Math.max(...xs))
  const top = clamp01(Math.min(...ys))
  const bottom = clamp01(Math.max(...ys))
  const width = right - left
  const height = bottom - top
  if (width <= 0 || height <= 0) {
    return null
  }
  return {
    left,
    top,
    width,
    height,
  }
})

const focusBoxVisible = computed<boolean>(() => focusBoxPinned.value || focusBoxHovered.value)
const overlayFocusBox = computed<FocusBoxRect | null>(() => (focusBoxVisible.value ? transformedFocusBox.value : null))

const depthMapUrl = computed<string>(() => {
  const raw = file.metadata.depthMapUrl
  if (typeof raw !== 'string') {
    return ''
  }
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : ''
})

const shouldAutoPlay = computed(() => overlayImageReady && !livePhotoPlaying.value)
const overlayViewerStyle = computed<Record<string, string>>(() => {
  const style: Record<string, string> = { touchAction: viewerTouchAction }
  const width = file.width
  const height = file.height
  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
    style['--overlay-aspect'] = `${width} / ${height}`
  }
  return style
})

const { t } = useI18n()

const canOpenPreview = computed(() => previewEnabled && Boolean(resolvedPreviewImageSrc.value))
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
    focusBoxPinned.value = false
    focusBoxHovered.value = false
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

function handleFocusHover(value: boolean): void {
  focusBoxHovered.value = value
}

function handleFocusToggle(): void {
  focusBoxPinned.value = !focusBoxPinned.value
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
          class="overlay-viewer relative flex w-full shrink-0 items-center justify-center overflow-hidden bg-black md:h-full"
          :style="overlayViewerStyle"
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
            :style="[overlayImageFitStyle, overlayImageTransformStyle]"
            class="max-h-full max-w-full select-none object-contain"
            muted
            playsinline
            preload="metadata"
            @ended="handleLivePhotoEnded"
          />
          <DepthMapViewer
            v-show="!livePhotoPlaying || !hasLivePhoto"
            :image-url="displayImageUrl"
            :depth-url="depthMapUrl"
            :placeholder-aspect-ratio="file.placeholderAspectRatio"
            :image-width="file.width"
            :image-height="file.height"
            :auto-play="shouldAutoPlay"
            :show-status-overlay="false"
            :focus-box="overlayFocusBox"
            :style="[overlayImageFitStyle, overlayImageTransformStyle]"
            class="max-h-full max-w-full select-none bg-transparent rounded-none"
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
            <div v-if="file.series.length > 0" class="flex flex-wrap items-center gap-2">
              <span
                v-for="item in file.series"
                :key="item.id"
                class="inline-flex items-center gap-1 rounded bg-elevated/80 px-2 py-1 text-xs text-muted ring-1 ring-default/30"
              >
                <Icon name="tabler:stack-2" class="h-3.5 w-3.5" />
                <span>{{ item.title }}</span>
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
              :focus-entry="focusEntry"
              :crop-entry="cropEntry"
              :lightroom-recipe="lightroomRecipe"
              :exposure-entries="exposureEntries"
              :has-metadata="hasMetadata"
              :focus-indicator-active="focusBoxVisible"
              @focus-hover="handleFocusHover"
              @focus-toggle="handleFocusToggle"
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
      :src="resolvedPreviewImageSrc"
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

@supports (height: 100svh) {
  .overlay-root {
    height: 100svh;
  }
}

.overlay-viewer {
  max-height: calc(100dvh - 100px);
}

@media (max-width: 767px) {
  .overlay-viewer {
    aspect-ratio: var(--overlay-aspect, auto);
    height: auto;
    max-height: none;
  }
}

@media (min-width: 768px) {
  .overlay-viewer {
    max-height: 100dvh;
  }
}

@supports (height: 100svh) {
  .overlay-viewer {
    max-height: calc(100svh - 100px);
  }
  @media (min-width: 768px) {
    .overlay-viewer {
      max-height: 100svh;
    }
  }
  @media (max-width: 767px) {
    .overlay-viewer {
      max-height: none;
    }
  }
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
