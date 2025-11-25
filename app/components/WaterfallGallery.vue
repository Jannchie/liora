<script setup lang="ts">
import type { ImageSizes } from '@nuxt/image'
import type { LocationQueryValue } from 'vue-router'
import type { FileResponse, HistogramData } from '~/types/file'
import type { SiteSettings } from '~/types/site'
import { Chart } from 'chart.js/auto'
import { thumbHashToApproximateAspectRatio, thumbHashToDataURL } from 'thumbhash'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, unref, watch } from 'vue'
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
    emptyText: undefined,
    scrollElement: undefined,
    siteSettings: undefined,
  },
)

const { t, locale } = useI18n()

const maxDisplayWidth = 400
const waterfallGap = 4
const infoCardBaseHeight = 260
const image = useImage()
const runtimeConfig = useRuntimeConfig()
const siteConfig = useSiteConfig()
const route = useRoute()
const router = useRouter()

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
const isHydrated = ref<boolean>(false)
const activeFile = ref<ResolvedFile | null>(null)
const histogram = ref<HistogramData | null>(null)
const overlayImageSrc = ref<string | null>(null)
const overlayImageLoader = ref<HTMLImageElement | null>(null)
const overlayImageAbortController = ref<AbortController | null>(null)
const overlayImageObjectUrl = ref<string | null>(null)
const overlayDownloadState = ref<OverlayDownloadState>({
  status: 'idle',
  loaded: 0,
  total: null,
})
const overlayDownloadHideDelayMs = 500
const overlayDownloadHideTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const overlayViewerRef = ref<HTMLElement | null>(null)
const overlayZoom = ref<number>(1)
const overlayPan = ref<{
  x: number
  y: number
}>({ x: 0, y: 0 })
const overlayZoomMin = 1
const overlayZoomMax = 5
const overlayZoomStep = 0.2
const overlayDragState = ref<{
  pointerId: number | null
  startX: number
  startY: number
  originX: number
  originY: number
}>({
  pointerId: null,
  startX: 0,
  startY: 0,
  originX: 0,
  originY: 0,
})
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
  previewUrl: string
  previewAttrs: ImageAttrs
  displayTitle: string
  placeholder?: string
  placeholderAspectRatio?: number
  overlayPlaceholderUrl?: string | null
  displaySize: DisplaySize
  imageAttrs: ImageAttrs
}

type OverlayDownloadStatus = 'idle' | 'loading' | 'done' | 'error'

interface OverlayDownloadState {
  status: OverlayDownloadStatus
  loaded: number
  total: number | null
}

const overlayRouteKey = 'photo'

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

interface OverlayStat {
  label: string
  icon: string
}

const metadataLabels = computed(() => ({
  title: t('gallery.metadata.title'),
  description: t('gallery.metadata.description'),
  work: t('gallery.metadata.work'),
  characters: t('gallery.metadata.characters'),
  location: t('gallery.metadata.location'),
  camera: t('gallery.metadata.device'),
  exposure: t('gallery.metadata.exposure'),
  captureTime: t('gallery.metadata.captureTime'),
  size: t('gallery.metadata.size'),
}))

const characterSeparator = computed(() => t('gallery.metadata.characterSeparator'))
const resolvedEmptyText = computed(() => props.emptyText ?? t('gallery.empty'))
const loadingText = computed(() => t('common.loading'))
const untitledLabel = computed(() => t('common.labels.untitled'))

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

function resolveKindLabel(kind: FileResponse['kind']): string {
  return kind === 'PHOTOGRAPHY' ? t('common.kinds.photography') : t('common.kinds.painting')
}

function formatDisplayDateTime(value: string | undefined): string | undefined {
  if (!value) {
    return undefined
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return toDisplayText(value)
  }
  return new Intl.DateTimeFormat(locale.value || undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed)
}

function computeDisplaySize(file: FileResponse, aspectRatio: number | undefined, targetWidth: number): DisplaySize {
  const width = file.width > 0 ? Math.min(file.width, targetWidth) : targetWidth
  const ratio
    = file.width > 0 && file.height > 0
      ? file.width / file.height
      : (aspectRatio && Number.isFinite(aspectRatio) && aspectRatio > 0
          ? aspectRatio
          : 1)
  const height = Math.round(width / ratio)
  return { width, height }
}

function resolveImageAttrs(src: string, displaySize: DisplaySize, fit: 'cover' | 'inside' = 'inside'): ImageAttrs {
  const modifiers: Record<string, number | string> = {
    width: displaySize.width,
    format: 'webp',
    fit,
  }
  if (fit === 'cover') {
    modifiers.height = displaySize.height
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

function resolveOverlayPlaceholderUrl(src: string | undefined, aspectRatio: number | undefined): string | null {
  const normalized = (src ?? '').trim()
  if (!normalized) {
    return null
  }
  const width = 48
  const modifiers: Record<string, number | string> = {
    width,
    format: 'webp',
    fit: 'inside',
    blur: 60,
    quality: 20,
  }
  const height
    = aspectRatio && Number.isFinite(aspectRatio) && aspectRatio > 0
      ? Math.max(1, Math.round(width / aspectRatio))
      : null
  if (height) {
    modifiers.height = height
  }
  const result = image.getImage(normalized, { modifiers })
  return result?.url ?? normalized
}

function runViewTransition(action: () => void): void {
  action()
}

function viewTransitionStyle(_id: number | null | undefined): Record<string, string> | undefined {
  return undefined
}

function entryTransitionStyle(id: number): Record<string, string> | undefined {
  if (activeFile.value?.id === id) {
    return undefined
  }
  return viewTransitionStyle(id)
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
      const displayTitle = resolveFileTitle(file, untitledLabel.value)
      const decoded = decodeThumbhash(file.metadata.thumbhash)
      const displaySize = computeDisplaySize(file, decoded?.aspectRatio, displayWidth)
      const imageUrl = (file.imageUrl ?? '').trim()
      const thumbnailUrl = (file.thumbnailUrl ?? '').trim()
      const baseImageUrl = imageUrl.length > 0 ? imageUrl : thumbnailUrl
      const imageAttrs = resolveImageAttrs(baseImageUrl, displaySize, 'inside')
      const previewSize = computeDisplaySize(
        file,
        decoded?.aspectRatio,
        Math.min(Math.max(displayWidth * 2, 800), Math.min(file.width || Number.MAX_SAFE_INTEGER, 2000)),
      )
      const previewAttrs = resolveImageAttrs(thumbnailUrl.length > 0 ? thumbnailUrl : baseImageUrl, previewSize, 'inside')
      const previewUrl = (previewAttrs.src ?? '').trim() || baseImageUrl
      const overlayPlaceholderUrl = resolveOverlayPlaceholderUrl(
        thumbnailUrl.length > 0 ? thumbnailUrl : baseImageUrl,
        decoded?.aspectRatio,
      )
      return {
        ...file,
        imageUrl,
        thumbnailUrl,
        displayTitle,
        coverUrl: previewUrl,
        previewUrl,
        previewAttrs,
        placeholder: decoded?.dataUrl,
        placeholderAspectRatio: decoded?.aspectRatio,
        overlayPlaceholderUrl,
        displaySize,
        imageAttrs,
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
  const configured = resolvedSiteConfig.value.name?.trim()
  if (configured && configured.length > 0) {
    return configured
  }
  return t('home.defaultTitle')
})
const siteDescription = computed(() => {
  const customized = resolvedSiteSettings.value?.description?.trim()
  if (customized && customized.length > 0) {
    return customized
  }
  const fallback = resolvedSiteConfig.value.description ?? ''
  if (fallback && fallback.length > 0) {
    return fallback
  }
  return t('home.defaultDescription')
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

onMounted(async () => {
  isHydrated.value = true
  await nextTick()
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
  clearOverlayDownloadHideTimer()
})

function resolveOverlayRouteId(value: LocationQueryValue | LocationQueryValue[] | undefined): number | null {
  const normalized = Array.isArray(value)
    ? value.find((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0) ?? null
    : value
  if (typeof normalized !== 'string') {
    return null
  }
  const parsed = Number.parseInt(normalized, 10)
  return Number.isFinite(parsed) ? parsed : null
}

async function syncOverlayRoute(fileId: number | null, navigation: 'push' | 'replace' = 'push'): Promise<void> {
  const currentValue = route.query[overlayRouteKey]
  const currentId = resolveOverlayRouteId(currentValue)
  const nextValue = fileId === null ? null : String(fileId)
  if (currentId !== null && nextValue !== null && currentId === fileId) {
    return
  }
  if (currentId === null && nextValue === null) {
    return
  }
  const nextQuery = { ...route.query }
  if (nextValue === null) {
    delete nextQuery[overlayRouteKey]
  }
  else {
    nextQuery[overlayRouteKey] = nextValue
  }
  const navigate = navigation === 'replace' ? router.replace : router.push
  await navigate({ query: nextQuery })
}

function resolveInlinePreviewSrc(event: MouseEvent | null | undefined, file: ResolvedFile): string | null {
  const container = event?.currentTarget instanceof HTMLElement ? event.currentTarget : null
  const imageElement = container?.querySelector('img')
  if (imageElement instanceof HTMLImageElement) {
    const currentSrc = imageElement.currentSrc?.trim() ?? ''
    const fallbackSrc = imageElement.src?.trim() ?? ''
    const resolved = currentSrc.length > 0 ? currentSrc : fallbackSrc
    if (resolved.length > 0) {
      return resolved
    }
  }
  const fallback = file.imageAttrs?.src ?? file.thumbnailUrl ?? ''
  const normalized = fallback.trim()
  return normalized.length > 0 ? normalized : null
}

function openOverlay(file: ResolvedFile, syncRoute: boolean = true, immediateSrc: string | null = null): void {
  activeFile.value = file
  resetOverlayZoom()
  startOverlayImageLoad(file, immediateSrc)
  destroyHistogramChart()
  const cachedHistogram = normalizeHistogram(file.metadata.histogram)
  histogram.value = cachedHistogram
  if (syncRoute) {
    void syncOverlayRoute(file.id, 'push')
  }
}

function closeOverlay(syncRoute: boolean = true): void {
  activeFile.value = null
  destroyHistogramChart()
  histogram.value = null
  resetOverlayImage()
  if (syncRoute) {
    void syncOverlayRoute(null, 'replace')
  }
}

function handleEntryClick(event: MouseEvent, file: ResolvedFile): void {
  runViewTransition(() => openOverlay(file, true, resolveInlinePreviewSrc(event, file)))
}

function handleOverlayClose(): void {
  runViewTransition(() => closeOverlay())
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
    entries.push({ label: metadataLabels.value.title, value: title, icon: 'mdi:format-title' })
  }
  const description = toDisplayText(file.description)
  if (description) {
    entries.push({ label: metadataLabels.value.description, value: description, icon: 'mdi:text-box-outline' })
  }
  const fanworkTitle = toDisplayText(metadata.fanworkTitle || file.fanworkTitle)
  if (fanworkTitle) {
    entries.push({ label: metadataLabels.value.work, value: fanworkTitle, icon: 'mdi:palette-outline' })
  }
  if (metadata.characters.length > 0) {
    entries.push({
      label: metadataLabels.value.characters,
      value: metadata.characters.join(characterSeparator.value),
      icon: 'mdi:account-multiple-outline',
    })
  }
  const locationName = toDisplayText(metadata.locationName || file.location)
  if (locationName) {
    entries.push({ label: metadataLabels.value.location, value: locationName, icon: 'mdi:map-marker-outline' })
  }
  const cameraModel = toDisplayText(metadata.cameraModel || file.cameraModel)
  if (cameraModel) {
    entries.push({ label: metadataLabels.value.camera, value: cameraModel, icon: 'mdi:camera-outline' })
  }
  const aperture = toDisplayText(metadata.aperture)
  const focalLength = toDisplayText(metadata.focalLength)
  const iso = toDisplayText(metadata.iso)
  const shutterSpeed = toDisplayText(metadata.shutterSpeed)
  const exposureParts = [aperture, focalLength, iso, shutterSpeed].filter(Boolean) as string[]
  if (exposureParts.length > 0) {
    entries.push({ label: metadataLabels.value.exposure, value: exposureParts.join(' · '), icon: 'mdi:tune' })
  }
  const captureTime = formatDisplayDateTime(metadata.captureTime)
  if (captureTime) {
    entries.push({ label: metadataLabels.value.captureTime, value: captureTime, icon: 'mdi:clock-outline' })
  }
  entries.push({ label: metadataLabels.value.size, value: `${file.width} × ${file.height}`, icon: 'mdi:aspect-ratio' })
  return entries
})

const overlayStats = computed<OverlayStat[]>(() => {
  const file = activeFile.value
  if (!file) {
    return []
  }
  const stats: OverlayStat[] = [
    { label: `${file.width} × ${file.height}`, icon: 'mdi:aspect-ratio' },
  ]
  const captureTime = formatDisplayDateTime(file.metadata.captureTime)
  if (captureTime) {
    stats.push({ label: captureTime, icon: 'mdi:clock-outline' })
  }
  stats.push({
    label: resolveKindLabel(file.kind),
    icon: file.kind === 'PHOTOGRAPHY' ? 'mdi:camera-outline' : 'mdi:brush-outline',
  })
  return stats
})

function formatBytes(value: number | null): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return '0 B'
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = value
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }
  const precision = size >= 10 || unitIndex === 0 ? 0 : 1
  return `${size.toFixed(precision)} ${units[unitIndex]}`
}

const overlayDownloadPercent = computed<number | null>(() => {
  const state = overlayDownloadState.value
  if ((state.status !== 'loading' && state.status !== 'done') || state.total === null || state.total <= 0) {
    return null
  }
  return Math.min(100, Math.round((state.loaded / state.total) * 100))
})

const overlayDownloadLabel = computed<string | null>(() => {
  const state = overlayDownloadState.value
  if ((state.status !== 'loading' && state.status !== 'done') || state.total === null || state.total <= 0) {
    return null
  }
  const loadedText = formatBytes(state.loaded)
  return `${loadedText} / ${formatBytes(state.total)}`
})

const overlayDownloadVisible = computed<boolean>(() => {
  const state = overlayDownloadState.value
  return (state.status === 'loading' || state.status === 'done') && state.total !== null && state.total > 0
})

const overlayImageTransformStyle = computed<Record<string, string>>(() => {
  const transforms: string[] = []
  const pan = overlayPan.value
  const scale = overlayZoom.value
  if (pan.x !== 0 || pan.y !== 0) {
    transforms.push(`translate(${pan.x}px, ${pan.y}px)`)
  }
  if (scale !== 1) {
    transforms.push(`scale(${scale})`)
  }
  if (transforms.length === 0) {
    return {}
  }
  return {
    transform: transforms.join(' '),
    transformOrigin: 'center center',
    willChange: 'transform',
  }
})

const overlayZoomed = computed<boolean>(() => overlayZoom.value > overlayZoomMin)

const overlayZoomLabel = computed<string>(() => {
  const rounded = Math.min(overlayZoomMax, Math.max(overlayZoomMin, overlayZoom.value))
  const formatted = Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)
  return `${formatted}×`
})

const overlayZoomIndicatorVisible = computed<boolean>(() => overlayZoomed.value)

const overlayBackgroundStyle = computed<Record<string, string> | null>(() => {
  const file = activeFile.value
  if (!file) {
    return null
  }
  const source
    = file.placeholder
      || file.overlayPlaceholderUrl
      || file.previewUrl
      || file.coverUrl
      || file.imageUrl
      || file.thumbnailUrl
  if (!source) {
    return null
  }
  return {
    backgroundImage: `url('${source}')`,
  }
})

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && activeFile.value) {
    event.preventDefault()
    handleOverlayClose()
  }
  if (event.key === 'ArrowRight') {
    event.preventDefault()
    navigateOverlay(1)
  }
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    navigateOverlay(-1)
  }
}

const overlayRouteId = computed<number | null>(() => resolveOverlayRouteId(route.query[overlayRouteKey]))

watch(
  [
    overlayRouteId,
    resolvedFiles,
    isHydrated,
  ],
  ([
    routeId,
    files,
    hydrated,
  ]) => {
    if (!hydrated) {
      return
    }
    if (routeId === null) {
      if (activeFile.value) {
        closeOverlay(false)
      }
      return
    }
    const target = files.find(file => file.id === routeId)
    if (!target) {
      if (activeFile.value) {
        closeOverlay(false)
      }
      return
    }
    if (!activeFile.value || activeFile.value.id !== target.id) {
      openOverlay(target, false)
    }
  },
  { immediate: true },
)

watch(
  [
    histogram,
    histogramCanvasRef,
    isHydrated,
  ],
  () => {
    if (!isHydrated.value) {
      return
    }
    renderHistogram()
  },
  { flush: 'post' },
)

function destroyHistogramChart(): void {
  histogramChart.value?.destroy()
  histogramChart.value = null
}

function abortOverlayImageFetch(): void {
  overlayImageAbortController.value?.abort()
  overlayImageAbortController.value = null
}

function revokeOverlayObjectUrl(): void {
  if (overlayImageObjectUrl.value) {
    URL.revokeObjectURL(overlayImageObjectUrl.value)
    overlayImageObjectUrl.value = null
  }
}

function clearOverlayDownloadHideTimer(): void {
  if (overlayDownloadHideTimer.value !== null) {
    clearTimeout(overlayDownloadHideTimer.value)
    overlayDownloadHideTimer.value = null
  }
}

function scheduleOverlayDownloadReset(): void {
  clearOverlayDownloadHideTimer()
  overlayDownloadHideTimer.value = setTimeout(() => {
    overlayDownloadState.value = {
      status: 'idle',
      loaded: 0,
      total: null,
    }
    overlayDownloadHideTimer.value = null
  }, overlayDownloadHideDelayMs)
}

function markOverlayDownloadDone(loaded: number, total: number | null): void {
  overlayDownloadState.value = { status: 'done', loaded, total }
  scheduleOverlayDownloadReset()
}

function resetOverlayDownload(): void {
  clearOverlayDownloadHideTimer()
  overlayDownloadState.value = {
    status: 'idle',
    loaded: 0,
    total: null,
  }
}

function resetOverlayImage(): void {
  abortOverlayImageFetch()
  revokeOverlayObjectUrl()
  overlayImageLoader.value = null
  overlayImageSrc.value = null
  resetOverlayDownload()
  resetOverlayZoom()
}

function resetOverlayZoom(): void {
  overlayZoom.value = overlayZoomMin
  overlayPan.value = { x: 0, y: 0 }
  overlayDragState.value = {
    pointerId: null,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  }
}

function setOverlayZoom(next: number): void {
  const clamped = Math.min(overlayZoomMax, Math.max(overlayZoomMin, next))
  if (clamped === overlayZoom.value) {
    return
  }
  overlayZoom.value = clamped
  if (clamped === overlayZoomMin) {
    overlayPan.value = { x: 0, y: 0 }
  }
}

function handleOverlayWheel(event: WheelEvent): void {
  if (!activeFile.value) {
    return
  }
  event.preventDefault()
  const direction = event.deltaY > 0 ? -overlayZoomStep : overlayZoomStep
  setOverlayZoom(overlayZoom.value + direction)
}

function handleOverlayDoubleClick(event: MouseEvent): void {
  event.preventDefault()
  if (overlayZoomed.value) {
    resetOverlayZoom()
  }
  else {
    setOverlayZoom(Math.min(overlayZoomMax, 2))
  }
}

function handleOverlayPointerDown(event: PointerEvent): void {
  if (overlayZoom.value <= overlayZoomMin) {
    return
  }
  if (!(event.currentTarget instanceof HTMLElement)) {
    return
  }
  event.preventDefault()
  event.currentTarget.setPointerCapture(event.pointerId)
  overlayDragState.value = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    originX: overlayPan.value.x,
    originY: overlayPan.value.y,
  }
}

function handleOverlayPointerMove(event: PointerEvent): void {
  const state = overlayDragState.value
  if (state.pointerId === null || state.pointerId !== event.pointerId) {
    return
  }
  const deltaX = event.clientX - state.startX
  const deltaY = event.clientY - state.startY
  overlayPan.value = {
    x: state.originX + deltaX / overlayZoom.value,
    y: state.originY + deltaY / overlayZoom.value,
  }
}

function endOverlayPointerDrag(event: PointerEvent): void {
  const state = overlayDragState.value
  if (state.pointerId === null || state.pointerId !== event.pointerId) {
    return
  }
  if (event.currentTarget instanceof HTMLElement) {
    event.currentTarget.releasePointerCapture(event.pointerId)
  }
  overlayDragState.value = {
    pointerId: null,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  }
}

function navigateOverlay(offset: number): void {
  const currentId = activeFile.value?.id ?? null
  if (currentId === null) {
    return
  }
  const currentIndex = resolvedFiles.value.findIndex(file => file.id === currentId)
  if (currentIndex === -1) {
    return
  }
  const nextIndex = currentIndex + offset
  if (nextIndex < 0 || nextIndex >= resolvedFiles.value.length) {
    return
  }
  const target = resolvedFiles.value[nextIndex]
  if (!target) {
    return
  }
  runViewTransition(() => openOverlay(target))
}

function startOverlayImageLoad(file: ResolvedFile, immediateSrc: string | null = null): void {
  abortOverlayImageFetch()
  revokeOverlayObjectUrl()
  resetOverlayDownload()
  overlayImageLoader.value = null
  const previewSrc = file.previewAttrs?.src || file.previewUrl || file.coverUrl || file.imageUrl || file.thumbnailUrl
  const fullImageSrc = file.imageUrl || file.thumbnailUrl || previewSrc
  const firstAvailable = [
    immediateSrc,
    file.thumbnailUrl,
    file.imageAttrs?.src,
    file.coverUrl,
    file.previewUrl,
    file.imageUrl,
    file.placeholder,
    file.overlayPlaceholderUrl,
  ].find(value => typeof value === 'string' && value.trim().length > 0)?.trim()
  overlayImageSrc.value = firstAvailable || previewSrc
  if (typeof Image === 'undefined') {
    overlayImageSrc.value = fullImageSrc || overlayImageSrc.value
    return
  }

  const applyBlobSrc = (blob: Blob): void => {
    if (overlayImageAbortController.value?.signal.aborted) {
      return
    }
    revokeOverlayObjectUrl()
    const objectUrl = URL.createObjectURL(blob)
    overlayImageObjectUrl.value = objectUrl
    overlayImageSrc.value = objectUrl
  }

  const startFullLoad = async (): Promise<void> => {
    if (!fullImageSrc) {
      return
    }
    if (typeof fetch === 'undefined') {
      overlayImageSrc.value = fullImageSrc
      return
    }
    const controller = new AbortController()
    overlayImageAbortController.value = controller
    overlayDownloadState.value = { status: 'loading', loaded: 0, total: null }
    try {
      const response = await fetch(fullImageSrc, {
        signal: controller.signal,
        mode: 'cors',
        credentials: 'omit',
      })
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`)
      }
      const contentLengthHeader = response.headers.get('content-length')
      const parsedTotal = contentLengthHeader ? Number.parseInt(contentLengthHeader, 10) : null
      const total = typeof parsedTotal === 'number' && Number.isFinite(parsedTotal) ? parsedTotal : null
      if (!response.body) {
        const blob = await response.blob()
        markOverlayDownloadDone(blob.size, total ?? blob.size)
        applyBlobSrc(blob)
        return
      }
      const reader = response.body.getReader()
      const chunks: ArrayBuffer[] = []
      let loaded = 0
      overlayDownloadState.value = { status: 'loading', loaded, total }
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          break
        }
        if (value) {
          const buffer = value.buffer instanceof ArrayBuffer
            ? value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength)
            : (() => {
                const copy = new ArrayBuffer(value.byteLength)
                new Uint8Array(copy).set(value)
                return copy
              })()
          chunks.push(buffer)
          loaded += value.length
          overlayDownloadState.value = { status: 'loading', loaded, total }
        }
      }
      const blob = new Blob(chunks, { type: response.headers.get('content-type') ?? 'image/jpeg' })
      markOverlayDownloadDone(blob.size, total ?? blob.size)
      applyBlobSrc(blob)
    }
    catch {
      if (controller.signal.aborted) {
        return
      }
      overlayDownloadState.value = { status: 'error', loaded: 0, total: null }
      overlayImageSrc.value = fullImageSrc
    }
    finally {
      overlayImageAbortController.value = null
    }
  }

  if (!previewSrc || previewSrc === fullImageSrc || previewSrc === overlayImageSrc.value) {
    void startFullLoad()
    return
  }

  const previewLoader = new Image()
  overlayImageLoader.value = previewLoader
  previewLoader.crossOrigin = 'anonymous'
  previewLoader.decoding = 'async'
  const handlePreviewLoad = async (): Promise<void> => {
    if (overlayImageLoader.value !== previewLoader) {
      return
    }
    if (previewLoader.decode) {
      try {
        await previewLoader.decode()
      }
      catch {
        // Ignore decode errors and still show the preview.
      }
    }
    overlayImageSrc.value = previewSrc
    overlayImageLoader.value = null
    void startFullLoad()
  }
  const handlePreviewError = (): void => {
    if (overlayImageLoader.value !== previewLoader) {
      return
    }
    overlayImageLoader.value = null
    void startFullLoad()
  }
  previewLoader.addEventListener('load', handlePreviewLoad)
  previewLoader.addEventListener('error', handlePreviewError)
  previewLoader.src = previewSrc
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
  <div v-if="isHydrated" ref="galleryRef" class="relative">
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
          :empty-text="resolvedEmptyText"
          :is-loading="isLoading"
          :display-size="infoCardDisplaySize"
        />
        <button
          v-else
          type="button"
          class="group relative block h-full w-full focus:outline-none"
          :aria-label="t('gallery.viewLarge', { title: entry.displayTitle })"
          @click="handleEntryClick($event, entry)"
        >
          <img
            :key="entry.id"
            :alt="entry.displayTitle"
            :style="[
              entryTransitionStyle(entry.id),
              entry.placeholder
                ? {
                  backgroundImage: `url(${entry.placeholder})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                }
                : undefined,
            ]"
            loading="lazy"
            class="h-full w-full object-contain bg-default transition duration-200 group-hover:opacity-90"
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
        <span>{{ loadingText }}</span>
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
        <div class="absolute inset-0" @click="handleOverlayClose" />
        <div class="relative flex h-full w-full">
          <div class="relative z-10 grid h-full w-full grid-cols-1 gap-4 bg-default text-default backdrop-blur md:grid-cols-[minmax(0,2fr)_minmax(280px,360px)] md:gap-0">
            <div
              ref="overlayViewerRef"
              class="relative flex min-h-0 items-center justify-center overflow-hidden bg-black touch-none"
              @wheel.prevent="handleOverlayWheel"
              @dblclick.prevent="handleOverlayDoubleClick"
              @pointerdown="handleOverlayPointerDown"
              @pointermove="handleOverlayPointerMove"
              @pointerup="endOverlayPointerDrag"
              @pointercancel="endOverlayPointerDrag"
              @pointerleave="endOverlayPointerDrag"
            >
              <img
                :key="activeFile.id"
                :src="overlayImageSrc || activeFile.previewUrl || activeFile.coverUrl || activeFile.imageUrl"
                :srcset="overlayImageSrc === (activeFile.previewAttrs?.src ?? '') ? activeFile.previewAttrs?.srcset : undefined"
                :sizes="overlayImageSrc === (activeFile.previewAttrs?.src ?? '') ? activeFile.previewAttrs?.sizes : undefined"
                crossorigin="anonymous"
                :width="activeFile.width"
                :height="activeFile.height"
                :style="[
                  viewTransitionStyle(activeFile.id),
                  // activeFile.placeholder
                  //   ? {
                  //     backgroundImage: `url(${activeFile.placeholder})`,
                  //     backgroundSize: 'cover',
                  //     backgroundPosition: 'center',
                  //     backgroundRepeat: 'no-repeat',
                  //   }
                  //   : undefined,
                  overlayImageTransformStyle,
                ]"
                :alt="activeFile.displayTitle"
                loading="eager"
                class="h-full w-full select-none object-contain"
              >
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
                  class="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-md bg-black/70 px-3 py-1 text-[11px] font-semibold text-white ring-1 ring-white/10 backdrop-blur"
                >
                  {{ overlayZoomLabel }}
                </div>
              </Transition>
            </div>
            <div class="flex min-h-0 flex-col gap-5 overflow-y-auto p-4 md:border-l md:border-default/20 md:p-6">
              <div class="space-y-3">
                <div class="flex items-start justify-between gap-3">
                  <div class="space-y-1">
                    <p class="flex items-center gap-2 text-xs uppercase tracking-wide text-muted">
                      <Icon
                        :name="activeFile.kind === 'PHOTOGRAPHY' ? 'mdi:camera-outline' : 'mdi:brush-outline'"
                        class="h-4 w-4"
                      />
                      <span>{{ resolveKindLabel(activeFile.kind) }}</span>
                    </p>
                    <h3 class="text-lg font-semibold leading-snug text-highlighted">
                      {{ activeFile.displayTitle }}
                    </h3>
                  </div>
                  <button
                    type="button"
                    class="flex items-center gap-2 rounded-md px-3 py-1 text-sm text-default ring-1 ring-default transition hover:bg-muted"
                    @click="handleOverlayClose"
                  >
                    <Icon name="mdi:close" class="h-4 w-4" />
                    <span>{{ t('common.actions.close') }}</span>
                  </button>
                </div>
                <div class="flex flex-wrap items-center gap-2 text-[11px] font-medium text-muted">
                  <div
                    v-for="stat in overlayStats"
                    :key="`${stat.icon}-${stat.label}`"
                    class="inline-flex items-center gap-1 rounded-full bg-default/60 px-2 py-1 text-highlighted ring-1 ring-default/20"
                  >
                    <Icon :name="stat.icon" class="h-3.5 w-3.5" />
                    <span class="leading-none">{{ stat.label }}</span>
                  </div>
                </div>
              </div>
              <div class="rounded-lg border border-default/20 bg-elevated/80">
                <div class="flex items-center justify-between border-b border-default/10 px-3 py-2 text-xs uppercase tracking-wide text-muted">
                  <div class="flex items-center gap-2">
                    <Icon name="mdi:chart-line" class="h-4 w-4" />
                    <span>{{ t('gallery.histogram.title') }}</span>
                  </div>
                </div>
                <div class="relative h-32 w-full p-3">
                  <canvas ref="histogramCanvasRef" class="h-full w-full" />
                  <div
                    v-if="!histogram"
                    class="absolute inset-0 flex items-center justify-center gap-2 text-xs text-muted"
                  >
                    <Icon name="line-md:loading-loop" class="h-4 w-4" />
                    <span>{{ t('gallery.histogram.pending') }}</span>
                  </div>
                </div>
              </div>
              <div class="rounded-lg border border-default/20 bg-elevated/80 text-sm text-default">
                <div class="flex items-center justify-between border-b border-default/10 px-3 py-2 text-xs uppercase tracking-wide text-muted">
                  <div class="flex items-center gap-2">
                    <Icon name="mdi:information-outline" class="h-4 w-4" />
                    <span>{{ t('gallery.metadata.section') }}</span>
                  </div>
                  <span class="rounded-full bg-default/60 px-2 py-[2px] text-[11px] font-semibold text-highlighted ring-1 ring-default/15">
                    {{ metadataEntries.length }}
                  </span>
                </div>
                <div v-if="metadataEntries.length > 0" class="divide-y divide-default/10">
                  <div
                    v-for="item in metadataEntries"
                    :key="item.label"
                    class="grid gap-1 px-3 py-3"
                  >
                    <p class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
                      <Icon :name="item.icon" class="h-4 w-4" />
                      <span>{{ item.label }}</span>
                    </p>
                    <p class="text-base leading-relaxed text-highlighted">
                      {{ item.value }}
                    </p>
                  </div>
                </div>
                <div v-else class="px-3 py-4 text-sm text-muted">
                  <p class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
                    <Icon name="mdi:alert-circle-outline" class="h-4 w-4" />
                    <span>{{ t('gallery.metadata.section') }}</span>
                  </p>
                  <p class="mt-2 flex items-center gap-2 text-highlighted">
                    <Icon name="mdi:information-outline" class="h-4 w-4 text-muted" />
                    <span>{{ t('gallery.metadata.empty') }}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
  <div
    v-else
    class="flex min-h-[50vh] items-center justify-center text-sm text-muted"
    aria-live="polite"
  >
    <Icon name="line-md:loading-loop" class="mr-2 h-5 w-5 text-primary-500" />
    <span>Loading gallery…</span>
  </div>
</template>
