<script setup lang="ts">
import type { ImageSizes } from '@nuxt/image'
import type { CSSProperties } from 'vue'
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
const overlayZoomMax = 5
const overlayZoomStep = 0.2
const overlayZoomEpsilon = 0.001
const overlayZoomIndicatorDurationMs = 900
const overlayZoomIndicatorVisible = ref<boolean>(false)
const overlayZoomIndicatorTimer = ref<ReturnType<typeof setTimeout> | null>(null)
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

interface OverlayPointer {
  clientX: number
  clientY: number
}

type HistogramChannel = 'red' | 'green' | 'blue' | 'luminance'

interface HistogramSummary {
  shadows: number
  midtones: number
  highlights: number
  peakChannel: HistogramChannel
  peakIndex: number
  monochrome: boolean
}

const metadataLabels = computed(() => ({
  title: t('gallery.metadata.title'),
  description: t('gallery.metadata.description'),
  work: t('gallery.metadata.work'),
  characters: t('gallery.metadata.characters'),
  location: t('gallery.metadata.location'),
  camera: t('gallery.metadata.device'),
  lens: t('gallery.metadata.lens'),
  exposure: t('gallery.metadata.exposure'),
  captureTime: t('gallery.metadata.captureTime'),
  exposureBias: t('gallery.metadata.exposureBias'),
  exposureProgram: t('gallery.metadata.exposureProgram'),
  exposureMode: t('gallery.metadata.exposureMode'),
  meteringMode: t('gallery.metadata.meteringMode'),
  whiteBalance: t('gallery.metadata.whiteBalance'),
  flash: t('gallery.metadata.flash'),
  colorSpace: t('gallery.metadata.colorSpace'),
  resolution: t('gallery.metadata.resolution'),
  software: t('gallery.metadata.software'),
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

const histogramSmoothingKernel = [1, 4, 6, 4, 1]

function smoothHistogramChannel(values: number[], kernel: number[]): number[] {
  const result = Array.from({ length: values.length }, () => 0)
  const radius = Math.floor(kernel.length / 2)
  const defaultWeight = kernel.reduce((sum, weight) => sum + weight, 0)
  for (let index = 0; index < values.length; index += 1) {
    let accumulator = 0
    let weightSum = 0
    for (let offset = -radius; offset <= radius; offset += 1) {
      const kernelIndex = offset + radius
      const weight = kernel[kernelIndex] ?? 0
      if (weight <= 0) {
        continue
      }
      const valueIndex = index + offset
      if (valueIndex < 0 || valueIndex >= values.length) {
        continue
      }
      const value = values[valueIndex]
      if (!Number.isFinite(value)) {
        continue
      }
      accumulator += value * weight
      weightSum += weight
    }
    const normalizedWeight = weightSum > 0 ? weightSum : defaultWeight
    result[index] = normalizedWeight > 0 ? accumulator / normalizedWeight : 0
  }
  return result
}

function smoothHistogramData(data: HistogramData): HistogramData {
  // Light smoothing to reduce jagged edges without altering overall distribution.
  return {
    red: smoothHistogramChannel(data.red, histogramSmoothingKernel),
    green: smoothHistogramChannel(data.green, histogramSmoothingKernel),
    blue: smoothHistogramChannel(data.blue, histogramSmoothingKernel),
    luminance: smoothHistogramChannel(data.luminance, histogramSmoothingKernel),
  }
}

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

const histogramSummary = computed<HistogramSummary | null>(() => {
  const value = histogram.value
  if (!value) {
    return null
  }
  let total = 0
  for (const entry of value.luminance) {
    if (Number.isFinite(entry)) {
      total += entry
    }
  }
  if (total <= 0) {
    return null
  }
  const sumRange = (start: number, end: number): number => {
    let sum = 0
    for (let index = start; index <= end; index += 1) {
      sum += value.luminance[index] ?? 0
    }
    return sum
  }
  const shadows = Math.max(0, Math.min(1, sumRange(0, 63) / total))
  const midtones = Math.max(0, Math.min(1, sumRange(64, 191) / total))
  const highlights = Math.max(0, Math.min(1, sumRange(192, 255) / total))
  const channels: Array<{ key: HistogramChannel, values: number[] }> = [
    { key: 'luminance', values: value.luminance },
    { key: 'red', values: value.red },
    { key: 'green', values: value.green },
    { key: 'blue', values: value.blue },
  ]
  let peak: { key: HistogramChannel, value: number, index: number } = { key: 'luminance', value: 0, index: 0 }
  for (const channel of channels) {
    for (let index = 0; index < channel.values.length; index += 1) {
      const current = channel.values[index] ?? 0
      if (current > peak.value) {
        peak = { key: channel.key, value: current, index }
      }
    }
  }
  return {
    shadows: Math.round(shadows * 100),
    midtones: Math.round(midtones * 100),
    highlights: Math.round(highlights * 100),
    peakChannel: peak.key,
    peakIndex: peak.index,
    monochrome: isMonochromeHistogram(value),
  }
})

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
  clearOverlayZoomIndicatorTimer()
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
  void nextTick(() => resetOverlayZoom())
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

function escapeRegExp(value: string): string {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\\$&`)
}

function dedupeCameraLens(
  camera: string | undefined,
  lens: string | undefined,
): { camera?: string, lens?: string } {
  const cameraText = toDisplayText(camera)
  const lensText = toDisplayText(lens)
  const separators = ['·', '|', '/']

  if (cameraText && lensText) {
    const pattern = new RegExp(`\\s*[·|/,-]?\\s*${escapeRegExp(lensText)}`, 'i')
    const cleanedCamera = cameraText.replace(pattern, '').trim().replace(/[·|/,-]+$/, '').trim()
    return {
      camera: toDisplayText(cleanedCamera) ?? cameraText,
      lens: lensText,
    }
  }

  if (cameraText && !lensText) {
    for (const separator of separators) {
      const index = cameraText.lastIndexOf(separator)
      if (index > 0 && index < cameraText.length - 2) {
        const base = cameraText.slice(0, index).trim()
        const extracted = cameraText.slice(index + 1).trim().replace(/^[·|/,-]+/, '').trim()
        if (base.length > 0 && extracted.length > 0) {
          return { camera: base, lens: extracted }
        }
      }
    }
    const dashIndex = cameraText.lastIndexOf(' - ')
    if (dashIndex > 0 && dashIndex < cameraText.length - 3) {
      const base = cameraText.slice(0, dashIndex).trim()
      const extracted = cameraText.slice(dashIndex + 3).trim()
      if (base.length > 0 && extracted.length > 0) {
        return { camera: base, lens: extracted }
      }
    }
  }

  return { camera: cameraText ?? undefined, lens: lensText ?? undefined }
}

function formatResolutionValue(
  resolutionX: string | undefined,
  resolutionY: string | undefined,
  resolutionUnit: string | undefined,
): string | undefined {
  const x = toDisplayText(resolutionX)
  const y = toDisplayText(resolutionY)
  const unitKey = toDisplayText(resolutionUnit)?.toLowerCase() ?? ''
  const unitMap: Record<string, string> = {
    'pixels/inch': t('gallery.metadata.resolutionUnit.inch'),
    'pixels/in': t('gallery.metadata.resolutionUnit.inch'),
    'ppi': t('gallery.metadata.resolutionUnit.inch'),
    'pixels/centimeter': t('gallery.metadata.resolutionUnit.cm'),
    'pixels/cm': t('gallery.metadata.resolutionUnit.cm'),
    'ppcm': t('gallery.metadata.resolutionUnit.cm'),
  }
  const unit = unitMap[unitKey] ?? toDisplayText(resolutionUnit)
  if (x && y) {
    return unit ? `${x} × ${y} ${unit}` : `${x} × ${y}`
  }
  if (x && unit) {
    return `${x} ${unit}`
  }
  if (y && unit) {
    return `${y} ${unit}`
  }
  return x ?? y ?? undefined
}

function translateEnum(value: string | undefined, dictionary: Record<string, string>): string | undefined {
  const text = toDisplayText(value)
  if (!text) {
    return undefined
  }
  const key = text.toLowerCase()
  const translated = dictionary[key]
  return translated ?? text
}

function translateExposureProgram(value: string | undefined): string | undefined {
  return translateEnum(value, {
    'not defined': t('admin.upload.options.exposureProgram.notDefined'),
    'manual': t('admin.upload.options.exposureProgram.manual'),
    'program': t('admin.upload.options.exposureProgram.program'),
    'normal program': t('admin.upload.options.exposureProgram.program'),
    'aperture priority': t('admin.upload.options.exposureProgram.aperturePriority'),
    'shutter priority': t('admin.upload.options.exposureProgram.shutterPriority'),
    'creative': t('admin.upload.options.exposureProgram.creative'),
    'action': t('admin.upload.options.exposureProgram.action'),
    'portrait': t('admin.upload.options.exposureProgram.portrait'),
    'landscape': t('admin.upload.options.exposureProgram.landscape'),
  })
}

function translateExposureMode(value: string | undefined): string | undefined {
  return translateEnum(value, {
    'auto': t('admin.upload.options.exposureMode.auto'),
    'manual': t('admin.upload.options.exposureMode.manual'),
    'auto bracket': t('admin.upload.options.exposureMode.bracket'),
    'bracket': t('admin.upload.options.exposureMode.bracket'),
  })
}

function translateMeteringMode(value: string | undefined): string | undefined {
  return translateEnum(value, {
    'unknown': t('admin.upload.options.metering.unknown'),
    'average': t('admin.upload.options.metering.average'),
    'center-weighted': t('admin.upload.options.metering.center'),
    'center weighted': t('admin.upload.options.metering.center'),
    'center-weighted average': t('admin.upload.options.metering.center'),
    'multi-spot': t('admin.upload.options.metering.multiSpot'),
    'multispot': t('admin.upload.options.metering.multiSpot'),
    'multi spot': t('admin.upload.options.metering.multiSpot'),
    'spot': t('admin.upload.options.metering.spot'),
    'pattern': t('admin.upload.options.metering.pattern'),
    'matrix': t('admin.upload.options.metering.pattern'),
    'partial': t('admin.upload.options.metering.partial'),
    'other': t('admin.upload.options.metering.other'),
  })
}

function translateWhiteBalance(value: string | undefined): string | undefined {
  return translateEnum(value, {
    auto: t('admin.upload.options.whiteBalance.auto'),
    manual: t('admin.upload.options.whiteBalance.manual'),
  })
}

function translateFlash(value: string | undefined): string | undefined {
  return translateEnum(value, {
    'did not fire': t('admin.upload.options.flash.didNotFire'),
    'auto (did not fire)': t('admin.upload.options.flash.autoDidNotFire'),
    'auto, did not fire': t('admin.upload.options.flash.autoDidNotFire'),
    'auto - did not fire': t('admin.upload.options.flash.autoDidNotFire'),
    'fired': t('admin.upload.options.flash.fired'),
    'auto (fired)': t('admin.upload.options.flash.autoFired'),
    'auto, fired': t('admin.upload.options.flash.autoFired'),
  })
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
    entries.push({ label: metadataLabels.value.title, value: title, icon: 'carbon:text-font' })
  }
  const description = toDisplayText(file.description)
  if (description) {
    entries.push({ label: metadataLabels.value.description, value: description, icon: 'carbon:document' })
  }
  const fanworkTitle = toDisplayText(metadata.fanworkTitle || file.fanworkTitle)
  if (fanworkTitle) {
    entries.push({ label: metadataLabels.value.work, value: fanworkTitle, icon: 'carbon:color-palette' })
  }
  if (metadata.characters.length > 0) {
    entries.push({
      label: metadataLabels.value.characters,
      value: metadata.characters.join(characterSeparator.value),
      icon: 'carbon:user-multiple',
    })
  }
  const locationName = toDisplayText(metadata.locationName || file.location)
  if (locationName) {
    entries.push({ label: metadataLabels.value.location, value: locationName, icon: 'carbon:location' })
  }
  const { camera, lens } = dedupeCameraLens(metadata.cameraModel || file.cameraModel, metadata.lensModel)
  if (camera) {
    entries.push({ label: metadataLabels.value.camera, value: camera, icon: 'carbon:camera' })
  }
  if (lens) {
    entries.push({ label: metadataLabels.value.lens, value: lens, icon: 'mdi:camera-iris' })
  }
  const captureTime = formatDisplayDateTime(metadata.captureTime)
  if (captureTime) {
    entries.push({ label: metadataLabels.value.captureTime, value: captureTime, icon: 'carbon:time' })
  }
  const colorSpace = toDisplayText(metadata.colorSpace)
  if (colorSpace) {
    entries.push({ label: metadataLabels.value.colorSpace, value: colorSpace, icon: 'carbon:color-palette' })
  }
  const resolution = formatResolutionValue(metadata.resolutionX, metadata.resolutionY, metadata.resolutionUnit)
  if (resolution) {
    entries.push({ label: metadataLabels.value.resolution, value: resolution, icon: 'carbon:crop' })
  }
  const software = toDisplayText(metadata.software)
  if (software) {
    entries.push({ label: metadataLabels.value.software, value: software, icon: 'mdi:application' })
  }
  return entries
})

const exposureEntries = computed<MetadataEntry[]>(() => {
  const file = activeFile.value
  if (!file) {
    return []
  }
  const { metadata } = file
  const entries: MetadataEntry[] = []
  const aperture = toDisplayText(metadata.aperture)
  if (aperture) {
    entries.push({
      label: t('gallery.metadata.aperture'),
      value: aperture,
      icon: 'carbon:aperture',
    })
  }
  const shutterSpeed = toDisplayText(metadata.shutterSpeed)
  if (shutterSpeed) {
    entries.push({
      label: t('gallery.metadata.shutterSpeed'),
      value: shutterSpeed,
      icon: 'carbon:timer',
    })
  }
  const iso = toDisplayText(metadata.iso)
  if (iso) {
    entries.push({
      label: t('gallery.metadata.iso'),
      value: iso,
      icon: 'carbon:iso',
    })
  }
  const focalLength = toDisplayText(metadata.focalLength)
  if (focalLength) {
    entries.push({
      label: t('gallery.metadata.focalLength'),
      value: focalLength,
      icon: 'carbon:ruler',
    })
  }
  const exposureBias = toDisplayText(metadata.exposureBias)
  if (exposureBias) {
    entries.push({
      label: metadataLabels.value.exposureBias,
      value: exposureBias,
      icon: 'mdi:brightness-5',
    })
  }
  const exposureProgram = toDisplayText(metadata.exposureProgram)
  if (exposureProgram) {
    entries.push({
      label: metadataLabels.value.exposureProgram,
      value: translateExposureProgram(exposureProgram) ?? exposureProgram,
      icon: 'mdi:format-list-bulleted',
    })
  }
  const exposureMode = toDisplayText(metadata.exposureMode)
  if (exposureMode) {
    entries.push({
      label: metadataLabels.value.exposureMode,
      value: translateExposureMode(exposureMode) ?? exposureMode,
      icon: 'mdi:tune',
    })
  }
  const meteringMode = toDisplayText(metadata.meteringMode)
  if (meteringMode) {
    entries.push({
      label: metadataLabels.value.meteringMode,
      value: translateMeteringMode(meteringMode) ?? meteringMode,
      icon: 'mdi:crosshairs-gps',
    })
  }
  const whiteBalance = toDisplayText(metadata.whiteBalance)
  if (whiteBalance) {
    entries.push({
      label: metadataLabels.value.whiteBalance,
      value: translateWhiteBalance(whiteBalance) ?? whiteBalance,
      icon: 'mdi:white-balance-auto',
    })
  }
  const flash = toDisplayText(metadata.flash)
  if (flash) {
    entries.push({
      label: metadataLabels.value.flash,
      value: translateFlash(flash) ?? flash,
      icon: 'carbon:flash',
    })
  }
  return entries
})

const hasMetadata = computed<boolean>(() => metadataEntries.value.length > 0 || exposureEntries.value.length > 0)

const overlayStats = computed<OverlayStat[]>(() => {
  const file = activeFile.value
  if (!file) {
    return []
  }
  const stats: OverlayStat[] = []
  const resolution = `${file.width} × ${file.height}`
  stats.push({ label: resolution, icon: 'carbon:crop' })
  const uploadedAt = formatDisplayDateTime(file.createdAt)
  if (uploadedAt) {
    stats.push({ label: uploadedAt, icon: 'carbon:upload' })
  }
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

const overlayBaseScale = computed<number>(() => {
  const container = overlayViewerRef.value
  const file = activeFile.value
  if (!container || !file) {
    return 1
  }
  const naturalWidth = Number.isFinite(file.width) && file.width > 0 ? file.width : container.clientWidth
  const naturalHeight = Number.isFinite(file.height) && file.height > 0 ? file.height : container.clientHeight
  if (naturalWidth <= 0 || naturalHeight <= 0) {
    return 1
  }
  const scale = Math.min(container.clientWidth / naturalWidth, container.clientHeight / naturalHeight)
  if (!Number.isFinite(scale) || scale <= 0) {
    return 1
  }
  return scale
})

const overlayZoomMin = computed<number>(() => {
  const base = overlayBaseScale.value
  const normalized = Number.isFinite(base) && base > 0 ? base : 1
  return Math.max(0.1, normalized)
})

const overlayImageTransformStyle = computed<CSSProperties>(() => {
  const transforms: string[] = []
  const pan = overlayPan.value
  const baseScale = overlayBaseScale.value
  const scale = baseScale > 0 ? overlayZoom.value / baseScale : overlayZoom.value
  if (pan.x !== 0 || pan.y !== 0) {
    transforms.push(`translate(${pan.x}px, ${pan.y}px)`)
  }
  if (scale !== 1) {
    transforms.push(`scale(${scale})`)
  }
  const style: CSSProperties = {}
  if (transforms.length > 0) {
    style.transform = transforms.join(' ')
    style.transformOrigin = 'center center'
    style.willChange = 'transform'
  }
  return style
})

const overlayScaleDisplay = computed<number>(() => overlayZoom.value)

const overlayZoomLabel = computed<string>(() => {
  const rounded = Math.min(overlayZoomMax, Math.max(overlayZoomMin.value, overlayScaleDisplay.value))
  const formatted = Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)
  return `${formatted}×`
})

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

watch(
  overlayBaseScale,
  (nextBase) => {
    if (!Number.isFinite(nextBase) || nextBase <= 0) {
      return
    }
    if (overlayZoom.value < nextBase - overlayZoomEpsilon) {
      overlayZoom.value = nextBase
      overlayPan.value = { x: 0, y: 0 }
    }
  },
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

function clearOverlayZoomIndicatorTimer(): void {
  if (overlayZoomIndicatorTimer.value !== null) {
    clearTimeout(overlayZoomIndicatorTimer.value)
    overlayZoomIndicatorTimer.value = null
  }
}

function showOverlayZoomIndicator(): void {
  overlayZoomIndicatorVisible.value = true
  clearOverlayZoomIndicatorTimer()
  overlayZoomIndicatorTimer.value = setTimeout(() => {
    overlayZoomIndicatorVisible.value = false
    overlayZoomIndicatorTimer.value = null
  }, overlayZoomIndicatorDurationMs)
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
  const base = overlayZoomMin.value
  overlayZoom.value = base
  overlayPan.value = { x: 0, y: 0 }
  overlayZoomIndicatorVisible.value = false
  clearOverlayZoomIndicatorTimer()
  overlayDragState.value = {
    pointerId: null,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  }
}

function computeOverlayPanForFocus(point: OverlayPointer, targetZoom: number): {
  x: number
  y: number
} | null {
  const viewer = overlayViewerRef.value
  if (!viewer || !Number.isFinite(targetZoom) || targetZoom <= 0) {
    return null
  }
  const base = overlayBaseScale.value
  const currentScale = overlayZoom.value / base
  const nextScale = targetZoom / base
  if (!Number.isFinite(currentScale) || currentScale <= 0 || !Number.isFinite(nextScale) || nextScale <= 0) {
    return null
  }
  const ratio = nextScale / currentScale
  const rect = viewer.getBoundingClientRect()
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2
  const dx = point.clientX - centerX
  const dy = point.clientY - centerY
  return {
    x: overlayPan.value.x - (dx - overlayPan.value.x) * (ratio - 1),
    y: overlayPan.value.y - (dy - overlayPan.value.y) * (ratio - 1),
  }
}

function setOverlayZoom(next: number, focalPoint?: OverlayPointer): void {
  const minZoom = overlayZoomMin.value
  const clamped = Math.min(overlayZoomMax, Math.max(minZoom, next))
  if (clamped === overlayZoom.value) {
    return
  }
  let nextPan = overlayPan.value
  if (clamped <= minZoom + overlayZoomEpsilon) {
    nextPan = { x: 0, y: 0 }
  }
  else if (focalPoint) {
    const focusedPan = computeOverlayPanForFocus(focalPoint, clamped)
    if (focusedPan) {
      nextPan = focusedPan
    }
  }
  overlayZoom.value = clamped
  overlayPan.value = nextPan
  showOverlayZoomIndicator()
}

function handleOverlayWheel(event: WheelEvent): void {
  if (!activeFile.value) {
    return
  }
  event.preventDefault()
  const direction = event.deltaY > 0 ? -overlayZoomStep : overlayZoomStep
  setOverlayZoom(overlayZoom.value + direction, { clientX: event.clientX, clientY: event.clientY })
}

function handleOverlayDoubleClick(event: MouseEvent): void {
  event.preventDefault()
  const isAtOriginal = Math.abs(overlayZoom.value - 1) <= overlayZoomEpsilon
  const target = isAtOriginal ? overlayZoomMin.value : 1
  const focal = target > overlayZoomMin.value + overlayZoomEpsilon
    ? { clientX: event.clientX, clientY: event.clientY }
    : undefined
  setOverlayZoom(target, focal)
}

function handleOverlayPointerDown(event: PointerEvent): void {
  if (overlayZoom.value <= overlayZoomMin.value + overlayZoomEpsilon) {
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
    x: state.originX + deltaX,
    y: state.originY + deltaY,
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
  const chartHistogram = smoothHistogramData(histogram.value)
  const labels = chartHistogram.red.map((_, index) => index)
  const monochrome = isMonochromeHistogram(histogram.value)
  const toneOverlay = {
    id: 'toneOverlay',
    beforeDraw(chartInstance: Chart<'line'>) {
      const { ctx, chartArea, scales } = chartInstance
      const xScale = scales.x
      if (!chartArea || !xScale) {
        return
      }
      const zones = [
        { start: 0, end: 85, color: 'rgba(255, 255, 255, 0.02)' },
        { start: 85, end: 170, color: 'rgba(255, 255, 255, 0.03)' },
        { start: 170, end: 255, color: 'rgba(255, 255, 255, 0.02)' },
      ]
      ctx.save()
      for (const zone of zones) {
        const startX = xScale.getPixelForValue(zone.start)
        const endX = xScale.getPixelForValue(zone.end)
        ctx.fillStyle = zone.color
        ctx.fillRect(startX, chartArea.top, endX - startX, chartArea.height)
      }
      ctx.restore()
    },
  }
  const baseDataset = {
    pointRadius: 0,
    tension: 0.35,
    cubicInterpolationMode: 'monotone' as const,
    fill: false,
    borderWidth: 2,
    backgroundColor: 'transparent',
  }
  const datasets = monochrome
    ? [
        {
          label: 'Luminance',
          data: chartHistogram.luminance,
          borderColor: '#ffffff',
          ...baseDataset,
        },
      ]
    : [
        {
          label: 'Red',
          data: chartHistogram.red,
          borderColor: histogramColors.value.red,
          ...baseDataset,
        },
        {
          label: 'Green',
          data: chartHistogram.green,
          borderColor: histogramColors.value.green,
          ...baseDataset,
        },
        {
          label: 'Blue',
          data: chartHistogram.blue,
          borderColor: histogramColors.value.blue,
          ...baseDataset,
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
      layout: {
        padding: {
          top: 8,
          right: 10,
          bottom: 8,
          left: 10,
        },
      },
      elements: {
        line: {
          borderJoinStyle: 'round',
        },
      },
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
            display: true,
            color: 'rgba(255, 255, 255, 0.06)',
          },
          border: {
            display: false,
          },
        },
        y: {
          display: false,
          grid: {
            display: true,
            color: 'rgba(255, 255, 255, 0.06)',
          },
          border: {
            display: false,
          },
        },
      },
    },
    plugins: [toneOverlay],
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
                  class="home-display-font pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-md bg-black/70 px-3 py-1 text-[11px] font-semibold text-white ring-1 ring-white/10 backdrop-blur"
                >
                  {{ overlayZoomLabel }}
                </div>
              </Transition>
            </div>
            <div class="home-display-font flex min-h-0 flex-col gap-4 overflow-y-auto p-3 md:border-l md:border-default/20 md:p-4">
              <div class="space-y-2.5">
                <div class="flex items-start justify-between gap-3">
                  <div class="space-y-1">
                    <h3 class="home-title-font text-lg font-semibold leading-snug text-highlighted">
                      {{ activeFile.displayTitle }}
                    </h3>
                  </div>
                  <button
                    type="button"
                    class="flex items-center gap-2 rounded-md px-3 py-1 text-sm text-default ring-1 ring-default transition hover:bg-muted"
                    @click="handleOverlayClose"
                  >
                    <Icon name="carbon:close" class="h-4 w-4" />
                    <span>{{ t('common.actions.close') }}</span>
                  </button>
                </div>
                <div class="flex flex-wrap items-center gap-2 text-[11px] font-medium text-muted">
                  <div
                    v-for="stat in overlayStats"
                    :key="`${stat.icon}-${stat.label}`"
                    class="inline-flex items-center gap-1 rounded bg-elevated/80 px-2 py-1 text-highlighted ring-1 ring-default/30"
                  >
                    <Icon :name="stat.icon" class="h-3.5 w-3.5" />
                    <span class="leading-none">{{ stat.label }}</span>
                  </div>
                </div>
              </div>
              <div class="space-y-3">
                <div class="rounded-lg border border-default/20 bg-elevated/80">
                  <div class="flex items-center justify-between border-b border-default/10 px-3 py-2 text-xs uppercase tracking-wide text-muted">
                    <div class="flex items-center gap-2">
                      <Icon name="carbon:chart-line" class="h-4 w-4" />
                      <span>{{ t('gallery.histogram.title') }}</span>
                    </div>
                  </div>
                  <div class="space-y-3 p-3">
                    <div class="relative h-36 w-full overflow-hidden rounded-md bg-default/60 ring-1 ring-default/10">
                      <canvas ref="histogramCanvasRef" class="absolute inset-0 h-full w-full" />
                      <div
                        v-if="!histogram"
                        class="absolute inset-0 flex items-center justify-center gap-2 text-xs text-muted"
                      >
                        <Icon name="line-md:loading-loop" class="h-4 w-4" />
                        <span>{{ t('gallery.histogram.pending') }}</span>
                      </div>
                    </div>
                    <div v-if="histogramSummary" class="grid grid-cols-3 gap-2 text-[11px]">
                      <div class="space-y-1">
                        <div class="flex items-center justify-between text-muted">
                          <span>{{ t('gallery.histogram.shadows') }}</span>
                          <span class="font-semibold text-highlighted">{{ histogramSummary.shadows }}%</span>
                        </div>
                        <div class="h-px w-full overflow-hidden rounded-full bg-default/40">
                          <div class="h-full rounded-full bg-primary-500" :style="{ width: `${histogramSummary.shadows}%` }" />
                        </div>
                      </div>
                      <div class="space-y-1">
                        <div class="flex items-center justify-between text-muted">
                          <span>{{ t('gallery.histogram.midtones') }}</span>
                          <span class="font-semibold text-highlighted">{{ histogramSummary.midtones }}%</span>
                        </div>
                        <div class="h-px w-full overflow-hidden rounded-full bg-default/40">
                          <div class="h-full rounded-full bg-primary-500" :style="{ width: `${histogramSummary.midtones}%` }" />
                        </div>
                      </div>
                      <div class="space-y-1">
                        <div class="flex items-center justify-between text-muted">
                          <span>{{ t('gallery.histogram.highlights') }}</span>
                          <span class="font-semibold text-highlighted">{{ histogramSummary.highlights }}%</span>
                        </div>
                        <div class="h-px w-full overflow-hidden rounded-full bg-default/40">
                          <div class="h-full rounded-full bg-primary-500" :style="{ width: `${histogramSummary.highlights}%` }" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="rounded-lg border border-default/20 bg-elevated/80 text-sm text-default">
                  <div class="flex items-center justify-between border-b border-default/10 px-3 py-2 text-xs uppercase tracking-wide text-muted">
                    <div class="flex items-center gap-2">
                      <Icon name="carbon:information" class="h-4 w-4" />
                      <span>{{ t('gallery.metadata.section') }}</span>
                    </div>
                    <span class="rounded-full bg-default/60 px-2 py-0.5 text-[11px] font-semibold text-highlighted ring-1 ring-default/15">
                      {{ metadataEntries.length + exposureEntries.length }}
                    </span>
                  </div>
                  <div v-if="hasMetadata" class="space-y-3 p-3">
                    <div v-if="exposureEntries.length > 0" class="space-y-3">
                      <div class="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
                        <Icon name="carbon:settings-adjust" class="h-4 w-4" />
                        <span>{{ t('gallery.metadata.exposure') }}</span>
                      </div>
                      <div class="grid grid-cols-2 gap-2">
                        <div
                          v-for="item in exposureEntries"
                          :key="item.label"
                          class="flex items-center gap-3 rounded-md bg-default/60 px-2 py-2 ring-1 ring-default/15"
                          :aria-label="`${item.label}: ${item.value}`"
                        >
                          <Icon :name="item.icon" class="h-4 w-4 text-muted" />
                          <div class="flex flex-col leading-tight">
                            <span class="text-[10px] uppercase tracking-wide text-muted">{{ item.label }}</span>
                            <span class="text-sm font-semibold text-highlighted">{{ item.value }}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div v-if="metadataEntries.length > 0" class="space-y-2">
                      <div
                        v-for="item in metadataEntries"
                        :key="item.label"
                        class="grid gap-1 rounded-md bg-default/60 px-2 py-2 ring-1 ring-default/15"
                      >
                        <p class="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted">
                          <Icon :name="item.icon" class="h-4 w-4" />
                          <span>{{ item.label }}</span>
                        </p>
                        <p class="text-base leading-relaxed text-highlighted">
                          {{ item.value }}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div v-else class="px-3 py-4 text-sm text-muted">
                    <p class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
                      <Icon name="carbon:warning" class="h-4 w-4" />
                      <span>{{ t('gallery.metadata.section') }}</span>
                    </p>
                    <p class="mt-2 flex items-center gap-2 text-highlighted">
                      <Icon name="carbon:information" class="h-4 w-4 text-muted" />
                      <span>{{ t('gallery.metadata.empty') }}</span>
                    </p>
                  </div>
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
