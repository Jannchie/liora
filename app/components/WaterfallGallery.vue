<script setup lang="ts">
import type { ImageSizes } from '@nuxt/image'
import type { FileResponse, HistogramData } from '~/types/file'
import type { SiteSettings } from '~/types/site'
import { Chart } from 'chart.js/auto'
import { thumbHashToApproximateAspectRatio, thumbHashToDataURL } from 'thumbhash'
import { computed, onBeforeUnmount, onMounted, ref, unref, watch } from 'vue'
import { Waterfall } from 'vue-wf'
import { resolveFileTitle } from '~/utils/file'

const props = withDefaults(
  defineProps<{
    files: FileResponse[]
    isLoading: boolean
    emptyText?: string
    scrollElement?: HTMLElement
    siteSettings?: SiteSettings | null
  }>(),
  {
    emptyText: '暂无数据',
    scrollElement: undefined,
    siteSettings: undefined,
  },
)

const maxDisplayWidth = 400
const waterfallGap = 4
const infoCardBaseHeight = 260
const image = useImage()
const runtimeConfig = useRuntimeConfig()
const siteConfig = useSiteConfig()

type ImageAttrs = ImageSizes & {
  src: string
  width?: number
  height?: number
}

function getInitialColumns(): number {
  return 3
}

const galleryRef = ref<HTMLElement | null>(null)
const columns = ref<number>(getInitialColumns())
const wrapperWidth = ref<number>(maxDisplayWidth * columns.value + waterfallGap * (columns.value - 1))
const activeFile = ref<ResolvedFile | null>(null)
const histogram = ref<HistogramData | null>(null)
const overlayImageSrc = ref<string | null>(null)
const overlayImageLoader = ref<HTMLImageElement | null>(null)
const histogramCanvasRef = ref<HTMLCanvasElement | null>(null)
const histogramChart = ref<Chart | null>(null)

interface ThumbhashInfo {
  dataUrl: string
  aspectRatio: number
}

interface DisplaySize {
  width: number
  height: number
}

interface SocialLink {
  label: string
  url: string
  icon: string
}

type ResolvedFile = FileResponse & {
  coverUrl: string
  displayTitle: string
  placeholder?: string
  placeholderAspectRatio?: number
  displaySize: DisplaySize
  imageAttrs: ImageAttrs
}

interface InfoEntry {
  entryType: 'info'
  displaySize: DisplaySize
}

type WaterfallEntry = InfoEntry | (ResolvedFile & { entryType: 'file' })

interface MetadataEntry {
  label: string
  value: string
  icon: string
}

function toByteArrayFromBase64(value: string): Uint8Array {
  if (typeof atob === 'function') {
    const binary = atob(value)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.codePointAt(index) || 0
    }
    return bytes
  }
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(value, 'base64'))
  }
  throw new Error('No base64 decoder available.')
}

function decodeThumbhash(value: string | undefined): ThumbhashInfo | undefined {
  if (!value) {
    return undefined
  }
  try {
    const bytes = toByteArrayFromBase64(value)
    const aspectRatio = thumbHashToApproximateAspectRatio(bytes)
    if (!Number.isFinite(aspectRatio) || aspectRatio <= 0) {
      return {
        dataUrl: thumbHashToDataURL(bytes),
        aspectRatio: 1,
      }
    }
    return {
      dataUrl: thumbHashToDataURL(bytes),
      aspectRatio,
    }
  }
  catch (error) {
    console.warn('Failed to decode thumbhash', error)
    return undefined
  }
}

function toTimestamp(value: string | undefined): number | null {
  if (!value) {
    return null
  }
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : parsed
}

function resolveSortTimestamp(file: FileResponse): number {
  const captureTimestamp = toTimestamp(file.metadata.captureTime)
  const createdTimestamp = toTimestamp(file.createdAt) ?? 0
  return captureTimestamp ?? createdTimestamp
}

function computeDisplaySize(file: FileResponse, aspectRatio: number | undefined, targetWidth: number): DisplaySize {
  const width = file.width > 0 ? Math.min(file.width, targetWidth) : targetWidth
  const ratio
    = aspectRatio && Number.isFinite(aspectRatio) && aspectRatio > 0
      ? aspectRatio
      : (file.width > 0 && file.height > 0
          ? file.width / file.height
          : 1)
  const height = Math.round(width / ratio)
  return { width, height }
}

function resolveImageAttrs(src: string, displaySize: DisplaySize): ImageAttrs {
  const modifiers = {
    width: displaySize.width,
    height: displaySize.height,
    format: 'webp',
    fit: 'cover',
  }
  const sizes = image.getSizes(src, {
    modifiers,
    sizes: `${maxDisplayWidth}px`,
  })
  const resolvedSrc
    = sizes.src
    ?? image.getImage(src, {
      modifiers,
    }).url
  return {
    ...sizes,
    src: resolvedSrc,
    width: displaySize.width,
    height: displaySize.height,
  }
}

function resolveHistogramUrl(file: ResolvedFile): string {
  const result = image.getImage(file.imageUrl, {
    modifiers: {
      width: 512,
      height: 512,
      format: 'webp',
      fit: 'inside',
    },
  })
  return result?.url ?? file.imageUrl
}

const columnWidth = computed(() => {
  if (columns.value <= 0) {
    return maxDisplayWidth
  }
  const available = wrapperWidth.value > 0
    ? (wrapperWidth.value - waterfallGap * (columns.value - 1)) / columns.value
    : maxDisplayWidth
  const clamped = Math.min(maxDisplayWidth, Math.floor(available))
  return Math.max(140, clamped)
})

const resolvedFiles = computed<ResolvedFile[]>(() => {
  const displayWidth = columnWidth.value
  return [...props.files]
    .map((file) => {
      const displayTitle = resolveFileTitle(file)
      const decoded = decodeThumbhash(file.metadata.thumbhash)
      const displaySize = computeDisplaySize(file, decoded?.aspectRatio, displayWidth)
      const coverUrl = file.imageUrl?.trim() || ''
      return {
        ...file,
        displayTitle,
        coverUrl,
        placeholder: decoded?.dataUrl,
        placeholderAspectRatio: decoded?.aspectRatio,
        displaySize,
        imageAttrs: resolveImageAttrs(coverUrl, displaySize),
      }
    })
    .toSorted((first, second) => resolveSortTimestamp(second) - resolveSortTimestamp(first))
})

const resolvedSiteSettings = computed(() => props.siteSettings ?? null)
const resolvedSiteConfig = computed(() => unref(siteConfig))
const siteName = computed(() => {
  const customized = resolvedSiteSettings.value?.name?.trim()
  if (customized && customized.length > 0) {
    return customized
  }
  return resolvedSiteConfig.value.name ?? 'Liora Gallery'
})
const siteDescription = computed(() => {
  const customized = resolvedSiteSettings.value?.description?.trim()
  if (customized && customized.length > 0) {
    return customized
  }
  const fallback = resolvedSiteConfig.value.description ?? ''
  return fallback && fallback.length > 0 ? fallback : ''
})
const photoCount = computed(() => resolvedFiles.value.length)

const socialLinks = computed<SocialLink[]>(() => {
  const links: SocialLink[] = []
  const social = resolvedSiteSettings.value?.social ?? runtimeConfig.public.social

  const appendLink = (label: string, url: string | undefined, icon: string): void => {
    const trimmed = (url ?? '').trim()
    if (trimmed.length > 0) {
      links.push({ label, url: trimmed, icon })
    }
  }

  appendLink('GitHub', social.github, 'mdi:github')
  appendLink('X', social.twitter, 'mdi:twitter')
  appendLink('Instagram', social.instagram, 'mdi:instagram')
  appendLink('Weibo', social.weibo, 'mdi:sina-weibo')
  return links
})

const infoCardDisplaySize = computed<DisplaySize>(() => ({
  width: columnWidth.value,
  height: Math.round((columnWidth.value / maxDisplayWidth) * infoCardBaseHeight),
}))

const waterfallEntries = computed<WaterfallEntry[]>(() => {
  const fileEntries = resolvedFiles.value.map(file => ({ ...file, entryType: 'file' as const }))
  return [{ entryType: 'info', displaySize: infoCardDisplaySize.value }, ...fileEntries]
})

const waterfallItems = computed(() => waterfallEntries.value.map(item => item.displaySize))

function getCssColor(name: string, fallback: string): string {
  if (globalThis.document !== undefined) {
    const value = getComputedStyle(globalThis.document.documentElement).getPropertyValue(name).trim()
    if (value.length > 0) {
      return value
    }
  }
  return fallback
}

const histogramColors = computed(() => ({
  red: getCssColor('--ui-color-error-500', '#ef4444'),
  green: getCssColor('--ui-color-success-500', '#22c55e'),
  blue: getCssColor('--ui-color-info-500', '#3b82f6'),
}))

function isMonochromeHistogram(data: HistogramData): boolean {
  const length = Math.min(data.red.length, data.green.length, data.blue.length)
  const tolerance = 1e-6
  for (let index = 0; index < length; index += 1) {
    const red = data.red[index] ?? 0
    const green = data.green[index] ?? 0
    const blue = data.blue[index] ?? 0
    if (Math.abs(red - green) > tolerance || Math.abs(red - blue) > tolerance || Math.abs(green - blue) > tolerance) {
      return false
    }
  }
  return true
}

function normalizeHistogram(raw: HistogramData | null | undefined): HistogramData | null {
  if (!raw) {
    return null
  }
  const buildChannel = (source: number[] | null | undefined): number[] | null => {
    if (!Array.isArray(source)) {
      return null
    }
    return Array.from({ length: 256 }, (_, index) => {
      const value = source[index] ?? 0
      return Number.isFinite(value) ? Number(value) : 0
    })
  }

  const red = buildChannel(raw.red)
  const green = buildChannel(raw.green)
  const blue = buildChannel(raw.blue)
  const luminance = buildChannel(raw.luminance) ?? Array.from({ length: 256 }, () => 0)

  if (!red || !green || !blue) {
    return null
  }

  return { red, green, blue, luminance }
}

const resizeObserver = ref<ResizeObserver | null>(null)

function updateColumns(): void {
  const width = galleryRef.value?.clientWidth ?? null
  if (typeof width === 'number' && Number.isFinite(width) && width > 0) {
    const target = Math.max(1, Math.ceil(width / maxDisplayWidth))
    columns.value = target
    wrapperWidth.value = width
  }
}

onMounted(() => {
  updateColumns()
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver.value = new ResizeObserver(() => updateColumns())
    if (galleryRef.value) {
      resizeObserver.value.observe(galleryRef.value)
    }
  }
  if (globalThis.window !== undefined) {
    globalThis.window.addEventListener('keydown', handleKeydown)
  }
})

onBeforeUnmount(() => {
  resizeObserver.value?.disconnect()
  if (globalThis.window !== undefined) {
    globalThis.window.removeEventListener('keydown', handleKeydown)
  }
  destroyHistogramChart()
})

function openOverlay(file: ResolvedFile): void {
  activeFile.value = file
  destroyHistogramChart()
  const cachedHistogram = normalizeHistogram(file.metadata.histogram)
  histogram.value = cachedHistogram
  if (!cachedHistogram) {
    void prepareHistogram(file)
  }
}

function closeOverlay(): void {
  activeFile.value = null
  destroyHistogramChart()
  histogram.value = null
  resetOverlayImage()
}

function toDisplayText(value: string | null | undefined): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

const metadataEntries = computed<MetadataEntry[]>(() => {
  const file = activeFile.value
  if (!file) {
    return []
  }
  const { metadata, displayTitle } = file
  const entries: MetadataEntry[] = []
  const title = toDisplayText(displayTitle)
  if (title) {
    entries.push({ label: '标题', value: title, icon: 'mdi:format-title' })
  }
  const description = toDisplayText(file.description)
  if (description) {
    entries.push({ label: '描述', value: description, icon: 'mdi:text-box-outline' })
  }
  const fanworkTitle = toDisplayText(metadata.fanworkTitle || file.fanworkTitle)
  if (fanworkTitle) {
    entries.push({ label: '作品', value: fanworkTitle, icon: 'mdi:palette-outline' })
  }
  if (metadata.characters.length > 0) {
    entries.push({ label: '角色', value: metadata.characters.join('、'), icon: 'mdi:account-multiple-outline' })
  }
  const locationName = toDisplayText(metadata.locationName || file.location)
  if (locationName) {
    entries.push({ label: '地点', value: locationName, icon: 'mdi:map-marker-outline' })
  }
  const cameraModel = toDisplayText(metadata.cameraModel || file.cameraModel)
  if (cameraModel) {
    entries.push({ label: '设备', value: cameraModel, icon: 'mdi:camera-outline' })
  }
  const aperture = toDisplayText(metadata.aperture)
  const focalLength = toDisplayText(metadata.focalLength)
  const iso = toDisplayText(metadata.iso)
  const shutterSpeed = toDisplayText(metadata.shutterSpeed)
  const exposureParts = [aperture, focalLength, iso, shutterSpeed].filter(Boolean) as string[]
  if (exposureParts.length > 0) {
    entries.push({ label: '参数', value: exposureParts.join(' · '), icon: 'mdi:tune' })
  }
  const captureTime = toDisplayText(metadata.captureTime)
  if (captureTime) {
    entries.push({ label: '拍摄时间', value: captureTime, icon: 'mdi:clock-outline' })
  }
  entries.push({ label: '尺寸', value: `${file.width} × ${file.height}`, icon: 'mdi:aspect-ratio' })
  return entries
})

const overlayBackgroundStyle = computed<Record<string, string> | null>(() => {
  const file = activeFile.value
  if (!file) {
    return null
  }
  const source = file.placeholder ?? file.coverUrl
  return {
    backgroundImage: `url('${source}')`,
  }
})

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && activeFile.value) {
    event.preventDefault()
    closeOverlay()
  }
}

watch([histogram, histogramCanvasRef], () => {
  renderHistogram()
}, { flush: 'post' })

watch(activeFile, (file) => {
  if (!file) {
    destroyHistogramChart()
    resetOverlayImage()
    return
  }
  startOverlayImageLoad(file)
})

function prepareHistogram(file: ResolvedFile): Promise<void> {
  if (globalThis.document === undefined || typeof Image === 'undefined') {
    histogram.value = null
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.decoding = 'async'
    function cleanup(): void {
      image.removeEventListener('load', handleLoad)
      image.removeEventListener('error', handleError)
    }

    function handleLoad(): void {
      const width = Math.max(1, Math.min(image.naturalWidth || image.width, 512))
      const height = Math.max(1, Math.min(image.naturalHeight || image.height, 512))
      const canvas = globalThis.document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) {
        histogram.value = null
        resolve()
        return
      }
      context.drawImage(image, 0, 0, width, height)
      const imageData = context.getImageData(0, 0, width, height)
      const bins: HistogramData = {
        red: Array.from({ length: 256 }, () => 0),
        green: Array.from({ length: 256 }, () => 0),
        blue: Array.from({ length: 256 }, () => 0),
        luminance: Array.from({ length: 256 }, () => 0),
      }
      for (let index = 0; index < imageData.data.length; index += 4) {
        const red = imageData.data[index]
        const green = imageData.data[index + 1]
        const blue = imageData.data[index + 2]
        bins.red[red] += 1
        bins.green[green] += 1
        bins.blue[blue] += 1
        const luminance = Math.min(255, Math.max(0, Math.round(0.299 * red + 0.587 * green + 0.114 * blue)))
        bins.luminance[luminance] += 1
      }
      const pixelCount = imageData.width * imageData.height
      if (pixelCount > 0) {
        for (const channel of Object.values(bins)) {
          for (let binIndex = 0; binIndex < channel.length; binIndex += 1) {
            channel[binIndex] = Number(channel[binIndex] / pixelCount)
          }
        }
      }
      if (activeFile.value?.id === file.id) {
        histogram.value = bins
      }
      cleanup()
      resolve()
    }
    function handleError(): void {
      histogram.value = null
      cleanup()
      resolve()
    }
    image.addEventListener('load', handleLoad)
    image.addEventListener('error', handleError)
    image.src = resolveHistogramUrl(file)
  })
}

function destroyHistogramChart(): void {
  histogramChart.value?.destroy()
  histogramChart.value = null
}

function resetOverlayImage(): void {
  overlayImageLoader.value = null
  overlayImageSrc.value = null
}

function startOverlayImageLoad(file: ResolvedFile): void {
  overlayImageSrc.value = file.coverUrl
  if (typeof Image === 'undefined') {
    overlayImageSrc.value = file.imageUrl
    return
  }
  const loader = new Image()
  overlayImageLoader.value = loader
  loader.crossOrigin = 'anonymous'
  loader.decoding = 'async'
  const handleLoad = (): void => {
    if (overlayImageLoader.value !== loader) {
      return
    }
    overlayImageSrc.value = file.imageUrl
    overlayImageLoader.value = null
  }
  const handleError = (): void => {
    if (overlayImageLoader.value !== loader) {
      return
    }
    overlayImageLoader.value = null
  }
  loader.addEventListener('load', handleLoad)
  loader.addEventListener('error', handleError)
  loader.src = file.imageUrl
}

function renderHistogram(): void {
  if (globalThis.document === undefined || !histogramCanvasRef.value || !histogram.value) {
    return
  }
  const context = histogramCanvasRef.value.getContext('2d')
  if (!context) {
    return
  }
  destroyHistogramChart()
  const labels = histogram.value.red.map((_, index) => index)
  const monochrome = isMonochromeHistogram(histogram.value)
  const datasets = monochrome
    ? [
        {
          label: 'Luminance',
          data: histogram.value.luminance,
          borderColor: '#ffffff',
          pointRadius: 0,
          tension: 0.2,
          borderWidth: 1.5,
        },
      ]
    : [
        {
          label: 'Red',
          data: histogram.value.red,
          borderColor: histogramColors.value.red,
          pointRadius: 0,
          tension: 0.2,
          borderWidth: 1.5,
        },
        {
          label: 'Green',
          data: histogram.value.green,
          borderColor: histogramColors.value.green,
          pointRadius: 0,
          tension: 0.2,
          borderWidth: 1.5,
        },
        {
          label: 'Blue',
          data: histogram.value.blue,
          borderColor: histogramColors.value.blue,
          pointRadius: 0,
          tension: 0.2,
          borderWidth: 1.5,
        },
      ]
  histogramChart.value = new Chart(context, {
    type: 'line',
    data: {
      labels,
      datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      events: [],
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          enabled: false,
        },
      },
      scales: {
        x: {
          display: false,
          grid: {
            display: false,
          },
        },
        y: {
          display: false,
          grid: {
            display: false,
          },
        },
      },
    },
  })
}
</script>

<template>
  <div ref="galleryRef" class="relative">
    <Waterfall
      :gap="waterfallGap"
      :cols="columns"
      :items="waterfallItems"
      :wrapper-width="wrapperWidth"
      :scroll-element="scrollElement"
    >
      <template v-for="entry in waterfallEntries" :key="entry.entryType === 'info' ? 'waterfall-info' : entry.id">
        <WaterfallInfoCard
          v-if="entry.entryType === 'info'"
          :site-name="siteName"
          :site-description="siteDescription"
          :photo-count="photoCount"
          :social-links="socialLinks"
          :empty-text="emptyText"
          :is-loading="isLoading"
          :display-size="infoCardDisplaySize"
        />
        <button
          v-else
          type="button"
          class="group relative block h-full w-full focus:outline-none"
          :aria-label="`查看 ${entry.displayTitle} 大图`"
          @click="openOverlay(entry)"
        >
          <img
            :key="entry.id"
            :alt="entry.displayTitle"
            :style="
              entry.placeholder
                ? {
                  backgroundImage: `url(${entry.placeholder})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                }
                : undefined
            "
            loading="lazy"
            class="h-full w-full object-cover transition duration-200 group-hover:opacity-90"
            v-bind="entry.imageAttrs"
          >
        </button>
      </template>
    </Waterfall>
    <div
      v-if="isLoading"
      class="absolute inset-0 flex items-center justify-center backdrop-blur-sm"
      :style="{ backgroundColor: 'color-mix(in oklab, var(--ui-bg) 70%, transparent)' }"
    >
      <div class="flex items-center gap-2 px-3 py-2 text-sm text-default ring-1 ring-default">
        <Icon name="line-md:loading-loop" class="h-5 w-5 text-primary-500" />
        <span>加载中…</span>
      </div>
    </div>
    <Teleport to="body">
      <div
        v-if="activeFile"
        class="fixed inset-0 z-50"
        role="dialog"
        aria-modal="true"
      >
        <div
          v-if="overlayBackgroundStyle"
          class="pointer-events-none absolute inset-0 scale-110 bg-cover bg-center blur-3xl"
          :style="overlayBackgroundStyle"
          aria-hidden="true"
        />
        <div class="absolute inset-0" @click="closeOverlay" />
        <div class="relative flex h-full w-full">
          <div class="relative z-10 grid h-full w-full grid-cols-1 gap-4 bg-default text-default backdrop-blur md:grid-cols-[minmax(0,2fr)_minmax(280px,360px)] md:gap-6">
            <div class="flex min-h-0 items-center justify-center overflow-hidden bg-black">
              <img
                :key="activeFile.id"
                :src="overlayImageSrc ?? activeFile.coverUrl"
                :alt="activeFile.displayTitle"
                class="max-h-full max-w-full object-contain"
              >
            </div>
            <div class="flex min-h-0 flex-col gap-4 overflow-y-auto p-4 md:p-6">
              <div class="flex items-start justify-between gap-3">
                <div class="space-y-1">
                  <p class="flex items-center gap-2 text-xs uppercase tracking-wide text-muted">
                    <Icon
                      :name="activeFile.kind === 'PHOTOGRAPHY' ? 'mdi:camera-outline' : 'mdi:brush-outline'"
                      class="h-4 w-4"
                    />
                    <span>{{ activeFile.kind === 'PHOTOGRAPHY' ? '摄影' : '插画' }}</span>
                  </p>
                  <h3 class="text-lg font-semibold leading-snug">
                    {{ activeFile.displayTitle }}
                  </h3>
                </div>
                <button
                  type="button"
                  class="flex items-center gap-2 px-3 py-1 text-sm text-default ring-1 ring-default transition hover:bg-muted"
                  @click="closeOverlay"
                >
                  <Icon name="mdi:close" class="h-4 w-4" />
                  <span>关闭</span>
                </button>
              </div>
              <div class="space-y-3 bg-elevated p-3 text-default">
                <p class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
                  <Icon name="mdi:chart-line" class="h-4 w-4 text-info-500" />
                  <span>直方图</span>
                </p>
                <div class="relative h-32 w-full">
                  <canvas ref="histogramCanvasRef" class="h-full w-full" />
                  <div
                    v-if="!histogram"
                    class="absolute inset-0 flex items-center justify-center gap-2 text-xs text-muted"
                  >
                    <Icon name="line-md:loading-loop" class="h-4 w-4" />
                    <span>计算中…</span>
                  </div>
                </div>
              </div>
              <div class="space-y-3 text-sm text-default">
                <div
                  v-for="item in metadataEntries"
                  :key="item.label"
                  class="bg-elevated p-3"
                >
                  <p class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
                    <Icon :name="item.icon" class="h-4 w-4" />
                    <span>{{ item.label }}</span>
                  </p>
                  <p class="mt-1 whitespace-pre-line wrap-break-word leading-relaxed text-highlighted">
                    {{ item.value }}
                  </p>
                </div>
                <div v-if="metadataEntries.length === 0" class="bg-elevated p-3">
                  <p class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
                    <Icon name="mdi:information-outline" class="h-4 w-4" />
                    <span>元数据</span>
                  </p>
                  <p class="mt-1 flex items-center gap-2 text-highlighted">
                    <Icon name="mdi:alert-circle-outline" class="h-4 w-4 text-muted" />
                    <span>暂无元数据</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
