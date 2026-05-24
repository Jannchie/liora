<script setup lang="ts">
import type { ComponentPublicInstance, CSSProperties } from 'vue'
import type { MediaFormState } from '~/types/admin'
import type { FileResponse, HistogramData } from '~/types/file'
import type {
  DisplaySize,
  FileLocation,
  ImageAttrs,
  LightroomRecipeView,
  MetadataEntry,
  OverlayStat,
  ResolvedFile,
  SiteInfoPlacement,
  SocialLink,
  WaterfallEntry,
} from '~/types/gallery'
import type { SiteSettings } from '~/types/site'
import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, unref, watch } from 'vue'
import { Waterfall } from 'vue-wf'
import { useDepthMapUpload } from '~/composables/useDepthMapUpload'
import { useFileEditApi } from '~/composables/useFileEditApi'
import { brandIconSet } from '~/constants/brand-icons'
import { arthashReady, decodeArthashToDataUrl, ensureArthashReady } from '~/utils/arthash'
import {
  normalizeExposureModeValue,
  normalizeExposureProgramValue,
  normalizeFlashValue,
  normalizeMeteringModeValue,
  normalizeWhiteBalanceValue,
} from '~/utils/exposure'
import { resolveFileTitle } from '~/utils/file'
import { createEmptyMediaFormState, fillMediaFormStateFromFile } from '~/utils/media-form'

const props = withDefaults(
  defineProps<{
    files: FileResponse[]
    isLoading: boolean
    emptyText?: string
    scrollElement?: HTMLElement | Document | Window | null
    siteSettings?: SiteSettings | null
    isAuthenticated?: boolean
    totalCount?: number | null
    overlayRootPath?: string
    overlayBasePath?: string
    overlayRouteParam?: string
  }>(),
  {
    emptyText: undefined,
    scrollElement: undefined,
    siteSettings: undefined,
    isAuthenticated: false,
    totalCount: undefined,
    overlayRootPath: '/',
    overlayBasePath: '/photo',
    overlayRouteParam: 'id',
  },
)

const { t, locale } = useI18n()
const toast = useToast()
const { saveFileEdit } = useFileEditApi()
const { uploadDepthMap } = useDepthMapUpload()

const maxDisplayWidth = 400
const minColumns = 2
const waterfallGap = 4
const infoCardBaseHeight = 260
const image = useImage()
const runtimeConfig = useRuntimeConfig()
const siteConfig = useSiteConfig()
const route = useRoute()
const router = useRouter()
const breakpoints = useBreakpoints(breakpointsTailwind)
const isSmallScreen = breakpoints.smaller('md')

function getInitialColumns(): number {
  return minColumns
}

const galleryRef = ref<HTMLElement | null>(null)
const columns = ref<number>(getInitialColumns())
const wrapperWidth = ref<number>(maxDisplayWidth * columns.value + waterfallGap * (columns.value - 1))
const isHydrated = ref<boolean>(false)

/*
 * Track which gallery entries' full images have finished decoding so the
 * template can fade them in over the arthash placeholder. Using a reactive
 * Set keyed by entry id (instead of a per-entry ref) lets vue-wf recycle
 * tile DOM without losing load state.
 */
const loadedEntryIds = reactive(new Set<number>())

function markEntryLoaded(id: number): void {
  loadedEntryIds.add(id)
}

function isEntryLoaded(id: number): boolean {
  return loadedEntryIds.has(id)
}

// vue-wf may mount an <img> whose `src` is already in the browser cache, in
// which case the load event has already fired before our @load handler is
// attached. Inspect the element on ref-callback and mark it loaded if so.
function onEntryImageRef(id: number, element: Element | null): void {
  if (!(element instanceof HTMLImageElement)) {
    return
  }
  if (element.complete && element.naturalWidth > 0) {
    markEntryLoaded(id)
  }
}
const activeFile = ref<ResolvedFile | null>(null)
const savedGalleryScrollTop = ref<number | null>(null)
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
const sharingLivePhoto = ref(false)
const preparingLivePhotoShare = ref(false)
const livePhotoShareAssets = ref<LivePhotoShareAssets | null>(null)
const livePhotoShareAbortController = ref<AbortController | null>(null)
const livePreviewRefs = new Map<number, HTMLVideoElement>()
const livePreviewPlaying = reactive<Record<number, boolean>>({})
const livePreviewActiveId = ref<number | null>(null)
const hoverPreviewEnabled = ref(true)
const hoverPreviewQuery = ref<MediaQueryList | null>(null)
const overlayDownloadHideDelayMs = 500
const overlayDownloadHideTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const overlayViewerRef = ref<HTMLElement | null>(null)
const overlayViewerSize = ref<{ width: number, height: number }>({ width: 0, height: 0 })
const overlayViewerResizeObserver = ref<ResizeObserver | null>(null)
const overlayZoom = ref<number>(1)
const overlayPan = ref<{
  x: number
  y: number
}>({ x: 0, y: 0 })
const overlayMobileScale = 3
const overlayPreviewScale = 2
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
const overlayPointers = ref<Map<number, { x: number, y: number }>>(new Map())
const overlayPinchBase = ref<{ distance: number, zoom: number } | null>(null)
const depthProcessing = reactive<Record<number, boolean>>({})

const overlayImageReady = computed<boolean>(() => overlayDownloadState.value.status === 'done')
const overlayPreviewSrc = computed<string | null>(() => {
  const file = activeFile.value
  if (!file) {
    return null
  }
  const original = typeof file.imageUrl === 'string' ? file.imageUrl.trim() : ''
  if (original.length > 0) {
    return resolveCorsSafeUrl(original) ?? original
  }
  const candidates = [
    file.previewUrl,
    file.coverUrl,
    overlayImageSrc.value,
  ]
  const base = candidates.find(value => typeof value === 'string' && value.trim().length > 0)?.trim()
  if (!base) {
    return null
  }
  if (!isSmallScreen.value) {
    return base
  }
  const targetWidth = resolveOverlayTargetWidth(file, overlayPreviewScale)
  const resolved = resolveOverlayFullImageSrc(base, targetWidth)
  return resolved || base
})
const overlaySessionId = ref(0)

const fileOverrides = ref<Record<number, FileResponse>>({})
const hiddenFileIds = ref<Set<number>>(new Set())
const isAdmin = computed(() => props.isAuthenticated ?? false)
const filesWithOverrides = computed<FileResponse[]>(() => props.files.map(file => fileOverrides.value[file.id] ?? file))
const showLoadingState = computed(() => !isHydrated.value || (props.isLoading && props.files.length === 0))

type OverlayDownloadStatus = 'idle' | 'loading' | 'done' | 'error'

interface OverlayDownloadState {
  status: OverlayDownloadStatus
  loaded: number
  total: number | null
}

interface LivePhotoShareAssets {
  fileId: number
  imageFile: File
  videoFile: File
}

interface OverlayPointer {
  clientX: number
  clientY: number
}

function nextOverlaySession(): number {
  overlaySessionId.value += 1
  return overlaySessionId.value
}

function isOverlaySessionActive(sessionId: number): boolean {
  return overlaySessionId.value === sessionId && activeFile.value !== null
}

const metadataLabels = computed(() => ({
  title: t('gallery.metadata.title'),
  description: t('gallery.metadata.description'),
  work: t('gallery.metadata.work'),
  characters: t('gallery.metadata.characters'),
  genre: t('gallery.metadata.genre'),
  location: t('gallery.metadata.location'),
  camera: t('gallery.metadata.device'),
  lens: t('gallery.metadata.lens'),
  exposure: t('gallery.metadata.exposure'),
  focus: t('gallery.metadata.focus'),
  crop: t('gallery.metadata.crop'),
  lightroom: t('gallery.metadata.lightroom'),
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
  focusDistance: t('gallery.metadata.focusDistance'),
  focusFrameSize: t('gallery.metadata.focusFrameSize'),
  focusLocation: t('gallery.metadata.focusLocation'),
  focusMode: t('gallery.metadata.focusMode'),
  focusPosition: t('gallery.metadata.focusPosition'),
  cropRect: t('gallery.metadata.cropRect'),
  cropAngle: t('gallery.metadata.cropAngle'),
  perspective: t('gallery.metadata.perspective'),
  size: t('gallery.metadata.size'),
}))

const genreTranslationMap = computed<Record<string, string>>(() => ({
  portrait: t('admin.files.genreOptions.portrait'),
  landscape: t('admin.files.genreOptions.landscape'),
  documentary: t('admin.files.genreOptions.documentary'),
  architecture: t('admin.files.genreOptions.architecture'),
  animal: t('admin.files.genreOptions.animal'),
  stilllife: t('admin.files.genreOptions.stillLife'),
  fashion: t('admin.files.genreOptions.fashion'),
  sports: t('admin.files.genreOptions.sports'),
  aerial: t('admin.files.genreOptions.aerial'),
  fineart: t('admin.files.genreOptions.fineArt'),
  commercial: t('admin.files.genreOptions.commercial'),
  macro: t('admin.files.genreOptions.macro'),
  street: t('admin.files.genreOptions.street'),
  night: t('admin.files.genreOptions.night'),
  abstract: t('admin.files.genreOptions.abstract'),
  other: t('admin.files.genreOptions.other'),
}))

function normalizeGenreKey(value: string | undefined): string | null {
  if (!value) {
    return null
  }
  const normalized = value.trim().toLowerCase().replaceAll(/[\s_-]+/g, '')
  return normalized.length > 0 ? normalized : null
}

const genreBadgeLabel = computed<string | null>(() => {
  const rawGenre = activeFile.value?.genre
  if (!rawGenre) {
    return null
  }
  const normalized = normalizeGenreKey(rawGenre)
  if (normalized && genreTranslationMap.value[normalized]) {
    return genreTranslationMap.value[normalized]
  }
  const trimmed = rawGenre.trim()
  return trimmed.length > 0 ? trimmed : null
})

const characterSeparator = computed(() => t('gallery.metadata.characterSeparator'))
const resolvedEmptyText = computed(() => props.emptyText ?? t('gallery.empty'))
const untitledLabel = computed(() => t('common.labels.untitled'))

function fileAspectRatio(file: { width: number, height: number }): number | undefined {
  if (file.width > 0 && file.height > 0) {
    return file.width / file.height
  }
  return undefined
}

function toTimestamp(value: string | undefined): number | null {
  if (!value) {
    return null
  }
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : parsed
}

function resolveUrlOrigin(value: string): string | null {
  try {
    const windowRef = globalThis.window
    const base = windowRef ? windowRef.location.href : undefined
    return new URL(value, base).origin
  }
  catch {
    return null
  }
}

function setLivePreviewRef(id: number, element: Element | ComponentPublicInstance | null): void {
  const resolvedElement = element instanceof Element ? element : element?.$el
  if (resolvedElement instanceof HTMLVideoElement) {
    livePreviewRefs.set(id, resolvedElement)
  }
  else {
    livePreviewRefs.delete(id)
  }
}

function stopLivePreview(id: number | null | undefined): void {
  if (id === null || id === undefined) {
    return
  }
  livePreviewPlaying[id] = false
  const video = livePreviewRefs.get(id)
  if (video) {
    video.pause()
    video.currentTime = 0
  }
  if (livePreviewActiveId.value === id) {
    livePreviewActiveId.value = null
  }
}

function playLivePreview(id: number): void {
  if (livePreviewActiveId.value !== null && livePreviewActiveId.value !== id) {
    stopLivePreview(livePreviewActiveId.value)
  }
  livePreviewActiveId.value = id
  livePreviewPlaying[id] = true
  const video = livePreviewRefs.get(id)
  if (!video) {
    return
  }
  video.currentTime = 0
  const playPromise = video.play()
  if (playPromise) {
    playPromise.catch(() => {
      stopLivePreview(id)
    })
  }
}

function handleLivePreviewEnter(entry: ResolvedFile): void {
  if (!hoverPreviewEnabled.value) {
    return
  }
  const liveVideoUrl = entry.metadata.livePhotoVideoUrl?.trim()
  if (!liveVideoUrl) {
    return
  }
  playLivePreview(entry.id)
}

function handleLivePreviewLeave(entry: ResolvedFile): void {
  if (!entry.metadata.livePhotoVideoUrl) {
    return
  }
  stopLivePreview(entry.id)
}

function handleLivePreviewEnded(id: number): void {
  stopLivePreview(id)
}

function handleHoverPreviewChange(event: MediaQueryListEvent): void {
  hoverPreviewEnabled.value = event.matches
  if (!event.matches) {
    stopLivePreview(livePreviewActiveId.value)
  }
}

function clearLivePhotoShareState(): void {
  livePhotoShareAssets.value = null
  if (livePhotoShareAbortController.value) {
    livePhotoShareAbortController.value.abort()
    livePhotoShareAbortController.value = null
  }
  preparingLivePhotoShare.value = false
}

async function prepareLivePhotoShareAssets(file: ResolvedFile): Promise<void> {
  const liveVideoUrl = file.metadata.livePhotoVideoUrl?.trim()
  if (!liveVideoUrl) {
    clearLivePhotoShareState()
    return
  }
  if (typeof File === 'undefined' || typeof fetch === 'undefined') {
    return
  }
  if (preparingLivePhotoShare.value) {
    return
  }
  if (livePhotoShareAssets.value?.fileId === file.id) {
    return
  }

  const controller = new AbortController()
  livePhotoShareAbortController.value?.abort()
  livePhotoShareAbortController.value = controller
  preparingLivePhotoShare.value = true
  try {
    const baseName = resolveShareBaseName(file)
    const imageResponse = await fetch(`/api/files/${file.id}/live-photo/image`, {
      signal: controller.signal,
    })
    const videoResponse = await fetch(`/api/files/${file.id}/live-photo/video`, {
      signal: controller.signal,
    })
    if (!imageResponse.ok || !videoResponse.ok) {
      throw new Error('Failed to prepare live photo files.')
    }
    const [imageBlob, videoBlob] = await Promise.all([imageResponse.blob(), videoResponse.blob()])
    if (controller.signal.aborted) {
      return
    }
    const imageFile = new File([imageBlob], `${baseName}.jpg`, { type: 'image/jpeg' })
    const videoFile = new File([videoBlob], `${baseName}.mov`, { type: 'video/quicktime' })
    livePhotoShareAssets.value = {
      fileId: file.id,
      imageFile,
      videoFile,
    }
  }
  catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return
    }
    console.warn('Failed to prepare live photo share assets', error)
    livePhotoShareAssets.value = null
  }
  finally {
    if (livePhotoShareAbortController.value === controller) {
      livePhotoShareAbortController.value = null
      preparingLivePhotoShare.value = false
    }
  }
}

function isCorsFetchableUrl(value: string | null | undefined): boolean {
  if (value === null || value === undefined) {
    return false
  }
  const normalized = value.trim()
  if (normalized.length === 0 || normalized.startsWith('data:') || normalized.startsWith('blob:')) {
    return false
  }
  const windowRef = globalThis.window
  if (!windowRef) {
    return false
  }
  const origin = resolveUrlOrigin(normalized)
  return origin !== null && origin === windowRef.location.origin
}

function resolveCorsSafeUrl(value: string | null | undefined): string | null {
  const normalized = value?.trim()
  if (!normalized) {
    return null
  }
  if (normalized.startsWith('data:') || normalized.startsWith('blob:')) {
    return normalized
  }
  if (isCorsFetchableUrl(normalized)) {
    return normalized
  }
  const proxied = image.getImage(normalized, { modifiers: {} })
  if (proxied?.url) {
    return proxied.url
  }
  return normalized
}

function resolveSortTimestamp(file: FileResponse): number {
  const captureTimestamp = toTimestamp(file.metadata.captureTime)
  const createdTimestamp = toTimestamp(file.createdAt) ?? 0
  return captureTimestamp ?? createdTimestamp
}

function hasSortTimestamp(file: FileResponse): boolean {
  const captureTime = file.metadata.captureTime.trim()
  const createdAt = file.createdAt.trim()
  return captureTime.length > 0 || createdAt.length > 0
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

function normalizeImageSize(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 1
  }
  return Math.max(1, Math.round(value))
}

function resolveOverlayContainerSize(): { width: number, height: number } {
  const measuredWidth = overlayViewerSize.value.width
  const measuredHeight = overlayViewerSize.value.height
  if (measuredWidth > 0 && measuredHeight > 0) {
    return { width: measuredWidth, height: measuredHeight }
  }
  if (globalThis.window === undefined) {
    return { width: 0, height: 0 }
  }
  const fallbackWidth = window.innerWidth || document.documentElement?.clientWidth || 0
  const fallbackHeight = window.innerHeight || document.documentElement?.clientHeight || 0
  return {
    width: Number.isFinite(fallbackWidth) ? fallbackWidth : 0,
    height: Number.isFinite(fallbackHeight) ? fallbackHeight : 0,
  }
}

function resolveOverlayDisplaySize(file: ResolvedFile): { width: number, height: number } | null {
  const container = resolveOverlayContainerSize()
  if (container.width <= 0 || container.height <= 0) {
    return null
  }
  const imageWidth = Number.isFinite(file.width) && file.width > 0 ? file.width : 0
  const imageHeight = Number.isFinite(file.height) && file.height > 0 ? file.height : 0
  if (imageWidth <= 0 || imageHeight <= 0) {
    return { width: container.width, height: container.height }
  }
  const containerRatio = container.width / container.height
  const imageRatio = imageWidth / imageHeight
  if (!Number.isFinite(containerRatio) || containerRatio <= 0 || !Number.isFinite(imageRatio) || imageRatio <= 0) {
    return { width: container.width, height: container.height }
  }
  if (imageRatio >= containerRatio) {
    const width = container.width
    const height = Math.round(container.width / imageRatio)
    return { width, height }
  }
  const height = container.height
  const width = Math.round(container.height * imageRatio)
  return { width, height }
}

function resolveOverlayTargetWidth(file: ResolvedFile, scale: number): number | null {
  const displaySize = resolveOverlayDisplaySize(file)
  if (!displaySize) {
    return null
  }
  const scaledWidth = normalizeImageSize(displaySize.width * scale)
  const maxWidth = Number.isFinite(file.width) && file.width > 0 ? Math.round(file.width) : null
  if (maxWidth && maxWidth > 0) {
    return Math.min(maxWidth, scaledWidth)
  }
  return scaledWidth
}

function resolveOverlayFullImageSrc(source: string | null | undefined, targetWidth: number | null): string {
  const normalized = source?.trim() ?? ''
  if (!normalized) {
    return ''
  }
  if (normalized.startsWith('data:') || normalized.startsWith('blob:')) {
    return normalized
  }
  if (targetWidth && targetWidth > 0) {
    const resized = image.getImage(normalized, {
      modifiers: {
        width: targetWidth,
        fit: 'inside',
      },
    })
    if (resized?.url) {
      return resized.url
    }
  }
  return resolveCorsSafeUrl(normalized) ?? normalized
}

function resolveImageAttrs(src: string, displaySize: DisplaySize, fit: 'cover' | 'inside' = 'inside'): ImageAttrs {
  const width = normalizeImageSize(displaySize.width)
  const height = normalizeImageSize(displaySize.height)
  const modifiers: Record<string, number | string> = {
    width,
    format: 'webp',
    fit,
    quality: 75,
  }
  if (fit === 'cover') {
    modifiers.height = height
  }
  const sizesValue = `${width}px`
  const sizesResult = image.getSizes(src, {
    modifiers,
    sizes: sizesValue,
  })
  const imageResult = image.getImage(src, {
    modifiers,
  })
  const resolvedSrc = imageResult.url ?? sizesResult.src ?? src
  return {
    ...sizesResult,
    src: resolvedSrc,
    sizes: sizesResult.sizes ?? sizesValue,
    width,
    height,
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
    ? wrapperWidth.value - waterfallGap * (columns.value - 1)
    : maxDisplayWidth * columns.value
  const width = available / columns.value
  const clamped = Math.min(maxDisplayWidth, width)
  return Math.max(1, clamped)
})

function toResolvedFile(file: FileResponse, displayWidth: number): ResolvedFile {
  const displayTitle = resolveFileTitle(file, untitledLabel.value)
  void arthashReady.value
  const placeholderDataUrl = decodeArthashToDataUrl(file.metadata.arthash) ?? undefined
  const aspectRatio = fileAspectRatio(file)
  const displaySize = computeDisplaySize(file, aspectRatio, displayWidth)
  const imageUrl = (file.imageUrl ?? '').trim()
  const baseImageUrl = imageUrl
  const imageAttrs = resolveImageAttrs(baseImageUrl, displaySize, 'inside')
  const previewSize = computeDisplaySize(
    file,
    aspectRatio,
    displayWidth,
  )
  const previewAttrs = resolveImageAttrs(baseImageUrl, previewSize, 'inside')
  const previewUrl = (previewAttrs.src ?? '').trim() || baseImageUrl
  const overlayPlaceholderUrl = resolveOverlayPlaceholderUrl(
    baseImageUrl,
    aspectRatio,
  )
  return {
    ...file,
    imageUrl,
    displayTitle,
    coverUrl: previewUrl,
    previewUrl,
    previewAttrs,
    placeholder: placeholderDataUrl,
    placeholderAspectRatio: aspectRatio,
    overlayPlaceholderUrl,
    displaySize,
    imageAttrs,
  }
}

const resolvedFiles = computed<ResolvedFile[]>(() => {
  const hidden = hiddenFileIds.value
  const displayWidth = columnWidth.value
  const items = [...filesWithOverrides.value]
    .filter(file => !hidden.has(file.id))
    .map(file => toResolvedFile(file, displayWidth))
  if (!items.every(file => hasSortTimestamp(file))) {
    return items
  }
  return items.toSorted((first, second) => resolveSortTimestamp(second) - resolveSortTimestamp(first))
})

const resolvedSiteSettings = computed(() => props.siteSettings ?? null)
const resolvedInfoPlacement = computed<SiteInfoPlacement>(() => {
  const placement = resolvedSiteSettings.value?.infoPlacement?.trim()
  return placement === 'header' ? 'header' : 'waterfall'
})
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
const photoCount = computed(() => {
  if (props.totalCount !== null && props.totalCount !== undefined) {
    return props.totalCount
  }
  return resolvedFiles.value.length
})

const socialLinks = computed<SocialLink[]>(() => {
  const links: SocialLink[] = []
  const social = resolvedSiteSettings.value?.social ?? runtimeConfig.public.social

  const appendLink = (label: string, url: string | undefined, icon: string): void => {
    const trimmed = (url ?? '').trim()
    if (trimmed.length > 0) {
      links.push({ label, url: trimmed, icon })
    }
  }

  appendLink('Homepage', social.homepage, 'tabler:home')
  appendLink('GitHub', social.github, 'tabler:brand-github')
  appendLink('X', social.twitter, 'tabler:brand-x')
  appendLink('Instagram', social.instagram, 'tabler:brand-instagram')
  appendLink('YouTube', social.youtube, 'tabler:brand-youtube')
  appendLink('TikTok', social.tiktok, 'tabler:brand-tiktok')
  appendLink('Bilibili', social.bilibili, 'tabler:brand-bilibili')
  appendLink('LinkedIn', social.linkedin, 'tabler:brand-linkedin')
  appendLink('Weibo', social.weibo, 'tabler:brand-weibo')
  return links
})

const infoCardDisplaySize = computed<DisplaySize>(() => ({
  width: columnWidth.value,
  height: Math.round((columnWidth.value / maxDisplayWidth) * infoCardBaseHeight),
}))

const waterfallEntries = computed<WaterfallEntry[]>(() => {
  const fileEntries = resolvedFiles.value.map(file => ({ ...file, entryType: 'file' as const }))
  if (resolvedInfoPlacement.value === 'header') {
    return fileEntries
  }
  return [{ entryType: 'info', displaySize: infoCardDisplaySize.value }, ...fileEntries]
})

const waterfallItems = computed(() => waterfallEntries.value.map(item => item.displaySize))

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
  const luminance = buildChannel(raw.luminance) ?? Array.from<number>({ length: 256 }).fill(0)

  if (!red || !green || !blue) {
    return null
  }

  return { red, green, blue, luminance }
}

const resizeObserver = ref<ResizeObserver | null>(null)

function updateColumns(): void {
  const width = galleryRef.value?.clientWidth ?? null
  if (typeof width === 'number' && Number.isFinite(width) && width > 0) {
    const target = Math.max(minColumns, Math.ceil(width / maxDisplayWidth))
    columns.value = target
    wrapperWidth.value = width
  }
}

onMounted(async () => {
  void ensureArthashReady()
  await nextTick()
  updateColumns()
  isHydrated.value = true
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver.value = new ResizeObserver(() => updateColumns())
    if (galleryRef.value) {
      resizeObserver.value.observe(galleryRef.value)
    }
  }
  if (globalThis.window !== undefined) {
    globalThis.window.addEventListener('keydown', handleKeydown)
    if (typeof globalThis.window.matchMedia === 'function') {
      const query = globalThis.window.matchMedia('(hover: hover) and (pointer: fine)')
      hoverPreviewQuery.value = query
      hoverPreviewEnabled.value = query.matches
      if (typeof query.addEventListener === 'function') {
        query.addEventListener('change', handleHoverPreviewChange)
      }
      else if (typeof query.addListener === 'function') {
        query.addListener(handleHoverPreviewChange)
      }
    }
  }
})

onBeforeUnmount(() => {
  nextOverlaySession()
  resizeObserver.value?.disconnect()
  overlayViewerResizeObserver.value?.disconnect()
  if (globalThis.window !== undefined) {
    globalThis.window.removeEventListener('keydown', handleKeydown)
  }
  const hoverQuery = hoverPreviewQuery.value
  if (hoverQuery) {
    if (typeof hoverQuery.removeEventListener === 'function') {
      hoverQuery.removeEventListener('change', handleHoverPreviewChange)
    }
    else if (typeof hoverQuery.removeListener === 'function') {
      hoverQuery.removeListener(handleHoverPreviewChange)
    }
  }
  stopLivePreview(livePreviewActiveId.value)
  clearLivePhotoShareState()
  abortOverlayImageFetch()
  revokeOverlayObjectUrl()
  clearOverlayDownloadHideTimer()
  clearOverlayZoomIndicatorTimer()
})

function resolveOverlayRouteId(value: string | string[] | null | undefined): number | null {
  const normalized = Array.isArray(value)
    ? value.find((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0) ?? null
    : value
  if (typeof normalized !== 'string') {
    return null
  }
  const parsed = Number.parseInt(normalized, 10)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeOverlayPath(value: string | undefined, fallback: string): string {
  const normalized = value?.trim() ?? ''
  if (!normalized) {
    return fallback
  }
  const withPrefix = normalized.startsWith('/') ? normalized : `/${normalized}`
  return withPrefix.length > 1 ? withPrefix.replaceAll(/\/+$/g, '') : withPrefix
}

function escapeOverlayPathRegExp(value: string): string {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\\$&`)
}

const resolvedOverlayRootPath = computed(() => normalizeOverlayPath(props.overlayRootPath, '/'))
const resolvedOverlayBasePath = computed(() => normalizeOverlayPath(props.overlayBasePath, '/photo'))
const currentSeriesSlug = computed<string | null>(() => {
  const match = resolvedOverlayRootPath.value.match(/^\/series\/([^/]+)$/)
  return match?.[1] ? decodeURIComponent(match[1]) : null
})
const resolvedOverlayRouteParam = computed(() => {
  const key = props.overlayRouteParam?.trim() ?? ''
  return key.length > 0 ? key : 'id'
})
const overlayPathPattern = computed(() => new RegExp(String.raw`^${escapeOverlayPathRegExp(resolvedOverlayBasePath.value)}/(\d+)/?$`))

function resolveOverlayRouteIdFromPathParam(): number | null {
  const param = route.params[resolvedOverlayRouteParam.value]
  const normalized = Array.isArray(param)
    ? param.find((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0) ?? null
    : param
  if (typeof normalized !== 'string') {
    const pathMatch = route.path.match(overlayPathPattern.value)
    if (!pathMatch?.[1]) {
      return null
    }
    return resolveOverlayRouteId(pathMatch[1])
  }
  return resolveOverlayRouteId(normalized)
}

function getOverlayRouteIdFromRoute(): number | null {
  return resolveOverlayRouteIdFromPathParam()
}

async function syncOverlayRoute(fileId: number | null, navigation: 'push' | 'replace' = 'push'): Promise<void> {
  const navigate = navigation === 'replace' ? router.replace : router.push
  const nextQuery = { ...route.query }
  const currentId = getOverlayRouteIdFromRoute()
  if (fileId === null && currentId === null && route.path === resolvedOverlayRootPath.value) {
    return
  }
  if (fileId !== null && currentId === fileId && route.path === `${resolvedOverlayBasePath.value}/${fileId}`) {
    return
  }
  if (fileId === null) {
    await navigate({ path: resolvedOverlayRootPath.value, query: nextQuery, hash: route.hash })
    return
  }
  await navigate({
    path: `${resolvedOverlayBasePath.value}/${fileId}`,
    query: nextQuery,
    hash: route.hash,
  })
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
  const fallback = file.imageAttrs?.src ?? file.imageUrl ?? ''
  const normalized = fallback.trim()
  return normalized.length > 0 ? normalized : null
}

function readGalleryScrollTop(): number | null {
  const target = props.scrollElement
  if (target instanceof HTMLElement) {
    return target.scrollTop
  }
  if (target instanceof Window) {
    return target.scrollY
  }
  if (target instanceof Document) {
    const element = target.scrollingElement ?? target.documentElement
    if (element instanceof HTMLElement) {
      return element.scrollTop
    }
  }
  if (globalThis.window !== undefined) {
    return window.scrollY
  }
  return null
}

function applyGalleryScrollTop(value: number): void {
  const target = props.scrollElement
  if (target instanceof HTMLElement) {
    target.scrollTop = value
    return
  }
  if (target instanceof Window) {
    target.scrollTo({ top: value, left: 0 })
    return
  }
  if (target instanceof Document) {
    const element = target.scrollingElement ?? target.documentElement
    if (element instanceof HTMLElement) {
      element.scrollTop = value
      return
    }
  }
  if (globalThis.window !== undefined) {
    window.scrollTo({ top: value, left: 0 })
  }
}

function openOverlay(file: ResolvedFile, syncRoute: boolean = true, immediateSrc: string | null = null): void {
  if (!activeFile.value && globalThis.window !== undefined) {
    const current = readGalleryScrollTop()
    if (current !== null && Number.isFinite(current)) {
      savedGalleryScrollTop.value = current
    }
  }
  stopLivePreview(livePreviewActiveId.value)
  nextOverlaySession()
  activeFile.value = file
  void nextTick(() => resetOverlayZoom())
  startOverlayImageLoad(file, immediateSrc)
  const cachedHistogram = normalizeHistogram(file.metadata.histogram)
  histogram.value = cachedHistogram
  if (syncRoute) {
    void syncOverlayRoute(file.id, 'push')
  }
}

function restoreGalleryScrollAfterClose(): void {
  if (globalThis.window === undefined) {
    return
  }
  const target = savedGalleryScrollTop.value
  if (target === null) {
    return
  }
  savedGalleryScrollTop.value = null
  void nextTick(() => {
    requestAnimationFrame(() => {
      applyGalleryScrollTop(target)
    })
  })
}

function closeOverlay(syncRoute: boolean = true): void {
  nextOverlaySession()
  activeFile.value = null
  histogram.value = null
  resetOverlayImage()
  if (syncRoute) {
    void syncOverlayRoute(null, 'replace')
  }
  restoreGalleryScrollAfterClose()
}

function handleEntryClick(event: MouseEvent, file: ResolvedFile): void {
  runViewTransition(() => openOverlay(file, true, resolveInlinePreviewSrc(event, file)))
}

watch(
  () => [activeFile.value?.id ?? null, activeFile.value?.metadata.livePhotoVideoUrl ?? ''],
  ([nextId]) => {
    clearLivePhotoShareState()
    if (nextId === null) {
      return
    }
    const file = activeFile.value
    if (file && file.metadata.livePhotoVideoUrl) {
      void prepareLivePhotoShareAssets(file)
    }
  },
)

function handleOverlayClose(): void {
  runViewTransition(() => {
    closeEditModal()
    closeOverlay()
  })
}

function handleOverlayEdit(): void {
  openEditModal()
}

function handleOverlayViewerMounted(element: HTMLElement | null): void {
  overlayViewerRef.value = element
}

async function handleShareLivePhoto(): Promise<void> {
  const file = activeFile.value
  if (!file || !file.metadata.livePhotoVideoUrl) {
    return
  }
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function' || typeof File === 'undefined') {
    toast.add({ title: t('gallery.livePhoto.shareUnsupported'), color: 'warning' })
    return
  }
  if (sharingLivePhoto.value) {
    return
  }
  if (!livePhotoShareAssets.value || livePhotoShareAssets.value.fileId !== file.id) {
    if (!preparingLivePhotoShare.value) {
      void prepareLivePhotoShareAssets(file)
    }
    toast.add({ title: t('gallery.livePhoto.sharePreparing'), color: 'warning' })
    return
  }

  const { imageFile, videoFile } = livePhotoShareAssets.value
  sharingLivePhoto.value = true
  try {
    if (typeof navigator.canShare === 'function' && !navigator.canShare({ files: [imageFile, videoFile] })) {
      toast.add({ title: t('gallery.livePhoto.shareUnsupported'), color: 'warning' })
      return
    }
    await navigator.share({
      files: [imageFile, videoFile],
      title: file.displayTitle,
    })
  }
  catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return
    }
    const description = error instanceof Error ? error.message : t('common.toast.loadFailed')
    toast.add({ title: t('gallery.livePhoto.shareFailed'), description, color: 'error' })
  }
  finally {
    sharingLivePhoto.value = false
  }
}

function toDisplayText(value: string | null | undefined): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

function toNumericCoordinate(value: number | null | undefined): number | null {
  if (typeof value !== 'number') {
    return null
  }
  return Number.isFinite(value) ? value : null
}

const editModalOpen = ref(false)
const editing = ref(false)
const editingFile = ref<ResolvedFile | null>(null)
const editSeriesIds = ref<number[]>([])
const editCaptureTimeLocal = ref<string>('')
const replaceFile = ref<File | null>(null)
const editForm = reactive<MediaFormState>(createEmptyMediaFormState())
const editFormModel = computed<MediaFormState>({
  get: () => editForm,
  set: (value) => {
    Object.assign(editForm, value)
  },
})

const editToastMessages = computed(() => ({
  updateFailed: t('admin.files.toast.updateFailed'),
  updateFailedFallback: t('admin.files.toast.updateFailedFallback'),
  depthSuccess: t('admin.files.toast.depthSuccess'),
  depthSuccessDescription: t('admin.files.toast.depthSuccessDescription'),
  depthFailed: t('admin.files.toast.depthFailed'),
  depthFailedFallback: t('admin.files.toast.depthFailedFallback'),
}))

function shouldKeepInCurrentSeries(file: FileResponse): boolean {
  const slug = currentSeriesSlug.value
  if (!slug) {
    return true
  }
  if (slug === '__uncategorized__') {
    return file.series.length === 0
  }
  return file.series.some(item => item.slug === slug)
}

function fillEditForm(file: FileResponse): void {
  const { captureTimeLocal, seriesIds } = fillMediaFormStateFromFile(editForm, file)
  editCaptureTimeLocal.value = captureTimeLocal
  editSeriesIds.value = seriesIds
}

function openEditModal(target?: ResolvedFile): void {
  if (!isAdmin.value) {
    return
  }
  const file = target ?? activeFile.value
  if (!file) {
    return
  }
  fillEditForm(file)
  editingFile.value = file
  editModalOpen.value = true
}

function closeEditModal(): void {
  editModalOpen.value = false
  editingFile.value = null
  editSeriesIds.value = []
  replaceFile.value = null
}

async function saveEditFromModal(): Promise<void> {
  if (!editingFile.value) {
    return
  }
  const fileId = editingFile.value.id
  editing.value = true
  try {
    const updated = await saveFileEdit({
      id: fileId,
      form: editForm,
      replaceFile: replaceFile.value,
      fallbackWidth: editingFile.value.width,
      fallbackHeight: editingFile.value.height,
      seriesIds: editSeriesIds.value,
    })
    fileOverrides.value = { ...fileOverrides.value, [updated.id]: updated }
    const nextHidden = new Set(hiddenFileIds.value)
    const keepInCurrentSeries = shouldKeepInCurrentSeries(updated)
    if (keepInCurrentSeries) {
      nextHidden.delete(updated.id)
    }
    else {
      nextHidden.add(updated.id)
    }
    hiddenFileIds.value = nextHidden
    const resolved = toResolvedFile(updated, columnWidth.value)
    activeFile.value = resolved
    editingFile.value = resolved
    closeEditModal()
  }
  catch (error) {
    const message = error instanceof Error ? error.message : editToastMessages.value.updateFailedFallback
    toast.add({ title: editToastMessages.value.updateFailed, description: message, color: 'error' })
  }
  finally {
    editing.value = false
  }
}

async function generateDepthMapFromEdit(): Promise<void> {
  if (!import.meta.client) {
    return
  }
  const file = editingFile.value
  if (!file) {
    return
  }
  if (depthProcessing[file.id]) {
    return
  }
  depthProcessing[file.id] = true
  try {
    await uploadDepthMap({
      fileId: file.id,
      imageUrl: file.imageUrl ?? '',
      missingImageMessage: editToastMessages.value.depthFailedFallback,
    })
    const updated = await $fetch<FileResponse>(`/api/files/${file.id}`)
    fileOverrides.value = { ...fileOverrides.value, [updated.id]: updated }
    editingFile.value = toResolvedFile(updated, columnWidth.value)
    toast.add({ title: editToastMessages.value.depthSuccess, description: editToastMessages.value.depthSuccessDescription })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : editToastMessages.value.depthFailedFallback
    toast.add({ title: editToastMessages.value.depthFailed, description: message, color: 'error' })
  }
  finally {
    depthProcessing[file.id] = false
  }
}

function escapeRegExp(value: string): string {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\\$&`)
}

interface CameraBrandRule {
  icon: string
  keywords: string[]
  label: string
  patterns?: RegExp[]
}

const cameraBrandRules: CameraBrandRule[] = [
  { icon: 'simple-icons:canon', keywords: ['canon', 'eos'], label: 'Canon' },
  { icon: 'simple-icons:nikon', keywords: ['nikon'], label: 'Nikon' },
  { icon: 'simple-icons:sony', keywords: ['sony', 'ilce', 'alpha'], label: 'Sony' },
  { icon: 'simple-icons:fujifilm', keywords: ['fujifilm', 'fuji'], label: 'Fujifilm' },
  { icon: 'simple-icons:panasonic', keywords: ['panasonic', 'lumix'], label: 'Panasonic' },
  { icon: 'simple-icons:olympus', keywords: ['olympus', 'om system', 'om-system', 'omd'], label: 'Olympus' },
  { icon: 'simple-icons:leica', keywords: ['leica'], label: 'Leica' },
  { icon: 'simple-icons:pentax', keywords: ['pentax'], label: 'Pentax' },
  {
    icon: 'simple-icons:ricoh',
    keywords: ['ricoh'],
    label: 'Ricoh',
    patterns: [/\bgr\s?(digital\s*)?(i{1,3}|\d)\b/],
  },
  { icon: 'simple-icons:sigma', keywords: ['sigma'], label: 'Sigma' },
  { icon: 'simple-icons:hasselblad', keywords: ['hasselblad'], label: 'Hasselblad' },
  { icon: 'simple-icons:dji', keywords: ['dji'], label: 'DJI' },
  { icon: 'simple-icons:gopro', keywords: ['gopro', 'hero'], label: 'GoPro' },
  { icon: 'simple-icons:apple', keywords: ['apple', 'iphone', 'ipad', 'ipod'], label: 'Apple' },
  {
    icon: 'simple-icons:samsung',
    keywords: ['samsung'],
    label: 'Samsung',
    patterns: [/\bsm\s?[a-z0-9]{3,}/],
  },
  { icon: 'simple-icons:huawei', keywords: ['huawei'], label: 'Huawei' },
  {
    icon: 'simple-icons:xiaomi',
    keywords: ['xiaomi', 'redmi', 'mi '],
    label: 'Xiaomi',
    patterns: [/\bmi\s?\d{1,2}\b/],
  },
  {
    icon: 'simple-icons:oppo',
    keywords: ['oppo'],
    label: 'Oppo',
    patterns: [/\bcph\d{3,}/],
  },
  { icon: 'simple-icons:vivo', keywords: ['vivo', 'iqoo'], label: 'Vivo' },
  { icon: 'simple-icons:oneplus', keywords: ['oneplus'], label: 'OnePlus' },
  { icon: 'simple-icons:google', keywords: ['pixel', 'google'], label: 'Google' },
  {
    icon: 'simple-icons:motorola',
    keywords: ['motorola', 'moto'],
    label: 'Motorola',
    patterns: [/\bxt\d{3,}/],
  },
  { icon: 'simple-icons:nokia', keywords: ['nokia'], label: 'Nokia' },
  { icon: 'simple-icons:honor', keywords: ['honor'], label: 'Honor' },
  { icon: 'simple-icons:meizu', keywords: ['meizu'], label: 'Meizu' },
  { icon: 'simple-icons:lenovo', keywords: ['lenovo'], label: 'Lenovo' },
  { icon: 'simple-icons:asus', keywords: ['asus', 'zenfone', 'rog phone', 'rog'], label: 'Asus' },
  { icon: 'simple-icons:sharp', keywords: ['sharp', 'aquos'], label: 'Sharp' },
  {
    icon: 'simple-icons:lg',
    keywords: ['lg '],
    label: 'LG',
    patterns: [/\blg\s?[a-z0-9]{2,}/],
  },
]

function normalizeCameraText(value: string): string {
  return value.toLowerCase().replaceAll(/[-_/]+/g, ' ').replaceAll(/\s+/g, ' ').trim()
}

function matchesCameraBrand(value: string, rule: CameraBrandRule): boolean {
  if (rule.keywords.some(keyword => value.includes(keyword))) {
    return true
  }
  return (rule.patterns ?? []).some(pattern => pattern.test(value))
}

function stripCameraBrand(cameraText: string, rule: CameraBrandRule): string {
  const candidates = [...rule.keywords, rule.label]
  for (const keyword of candidates) {
    if (!keyword || keyword.trim().length === 0) {
      continue
    }
    const pattern = new RegExp(String.raw`^\s*${escapeRegExp(keyword)}[\s·|/,:-]*`, 'i')
    const next = cameraText.replace(pattern, '').trim()
    if (next.length > 0 && next !== cameraText) {
      return next
    }
  }
  return cameraText.trim()
}

function stripBrandPrefixForDisplay(cameraText: string, rule: CameraBrandRule): string | undefined {
  let output = cameraText.trim()
  if (output.length === 0) {
    return undefined
  }
  const prefixes = [...rule.keywords, rule.label].filter(entry => entry && entry.trim().length > 0)
  if (prefixes.length === 0) {
    return output
  }
  const patterns = prefixes.map(prefix => new RegExp(String.raw`^\s*${escapeRegExp(prefix)}[\s·|/,:-]*`, 'i'))
  let mutated = true
  while (mutated && output.length > 0) {
    mutated = false
    for (const pattern of patterns) {
      const next = output.replace(pattern, '').trim()
      if (next.length > 0 && next !== output) {
        output = next
        mutated = true
      }
    }
  }
  return output.length > 0 ? output : undefined
}

function resolveCameraBrand(
  camera: string | undefined,
): { model: string | undefined, brandIcon: string | null, brandLabel: string | null } {
  const cameraText = toDisplayText(camera)
  if (!cameraText) {
    return { model: undefined, brandIcon: null, brandLabel: null }
  }
  const normalized = normalizeCameraText(cameraText)
  const rule = cameraBrandRules.find(entry => matchesCameraBrand(normalized, entry))
  if (!rule) {
    return { model: cameraText, brandIcon: null, brandLabel: null }
  }
  const brandIcon = (() => {
    const normalizedIcon = rule.icon.replace(/^simple-icons:/, '')
    return brandIconSet.has(normalizedIcon) ? rule.icon : null
  })()
  const model = toDisplayText(stripCameraBrand(cameraText, rule)) ?? cameraText
  const displayModel = brandIcon ? stripBrandPrefixForDisplay(model, rule) ?? rule.label ?? model : model
  return { model: displayModel, brandIcon, brandLabel: rule.label }
}

function dedupeCameraLens(
  camera: string | undefined,
  lens: string | undefined,
): { camera?: string, lens?: string } {
  const cameraText = toDisplayText(camera)
  const lensText = toDisplayText(lens)
  const separators = ['·', '|', '/']

  if (cameraText && lensText) {
    const pattern = new RegExp(String.raw`\s*[·|/,-]?\s*${escapeRegExp(lensText)}`, 'i')
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

function parseMetadataNumber(value: string | undefined): number | null {
  const text = toDisplayText(value)
  if (!text) {
    return null
  }
  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : null
}

function isNearlyEqual(value: number, target: number, epsilon: number = 1e-4): boolean {
  return Math.abs(value - target) <= epsilon
}

interface CropRectSummary {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}

function parseCropRectSummary(metadata: {
  cropLeft?: string
  cropTop?: string
  cropRight?: string
  cropBottom?: string
}): CropRectSummary | null {
  const left = parseMetadataNumber(metadata.cropLeft)
  const top = parseMetadataNumber(metadata.cropTop)
  const right = parseMetadataNumber(metadata.cropRight)
  const bottom = parseMetadataNumber(metadata.cropBottom)
  if (left === null || top === null || right === null || bottom === null) {
    return null
  }
  const width = right - left
  const height = bottom - top
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null
  }
  return {
    left,
    top,
    right,
    bottom,
    width,
    height,
  }
}

function formatCropRectValue(metadata: {
  cropLeft?: string
  cropTop?: string
  cropRight?: string
  cropBottom?: string
}): string | undefined {
  const summary = parseCropRectSummary(metadata)
  if (!summary) {
    return undefined
  }
  const isFullFrame = isNearlyEqual(summary.left, 0)
    && isNearlyEqual(summary.top, 0)
    && isNearlyEqual(summary.right, 1)
    && isNearlyEqual(summary.bottom, 1)
  if (isFullFrame) {
    return undefined
  }
  return `${(summary.width * 100).toFixed(2)}% × ${(summary.height * 100).toFixed(2)}% @ ${(summary.left * 100).toFixed(2)}%, ${(summary.top * 100).toFixed(2)}%`
}

function formatCropAngleValue(value: string | undefined): string | undefined {
  const numeric = parseMetadataNumber(value)
  if (numeric === null) {
    return toDisplayText(value)
  }
  if (Math.abs(numeric) < 1e-3) {
    return undefined
  }
  return `${numeric.toFixed(3)}°`
}

function formatPerspectiveValue(metadata: {
  perspectiveHorizontal?: string
  perspectiveVertical?: string
  perspectiveRotate?: string
  perspectiveScale?: string
  perspectiveUpright?: string
}): string | undefined {
  const parts: string[] = []
  const horizontal = parseMetadataNumber(metadata.perspectiveHorizontal)
  const vertical = parseMetadataNumber(metadata.perspectiveVertical)
  const rotate = parseMetadataNumber(metadata.perspectiveRotate)
  const scale = parseMetadataNumber(metadata.perspectiveScale)
  const upright = toDisplayText(metadata.perspectiveUpright)
  if (horizontal !== null && Math.abs(horizontal) >= 1e-3) {
    parts.push(`H ${horizontal.toFixed(2)}`)
  }
  if (vertical !== null && Math.abs(vertical) >= 1e-3) {
    parts.push(`V ${vertical.toFixed(2)}`)
  }
  if (rotate !== null && Math.abs(rotate) >= 1e-3) {
    parts.push(`R ${rotate.toFixed(2)}`)
  }
  if (scale !== null && Math.abs(scale - 100) >= 1e-3) {
    parts.push(`S ${scale.toFixed(2)}`)
  }
  const uprightKey = upright?.trim().toLowerCase()
  const hiddenUprightValues = new Set(['auto', 'off', 'none', '0', 'false', 'n/a', 'na'])
  if (upright && (!uprightKey || !hiddenUprightValues.has(uprightKey))) {
    parts.push(`Upright ${upright}`)
  }
  return parts.length > 0 ? parts.join(' · ') : undefined
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
  return translateEnum(normalizeExposureProgramValue(value), {
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
  return translateEnum(normalizeExposureModeValue(value), {
    'auto': t('admin.upload.options.exposureMode.auto'),
    'manual': t('admin.upload.options.exposureMode.manual'),
    'auto bracket': t('admin.upload.options.exposureMode.bracket'),
    'bracket': t('admin.upload.options.exposureMode.bracket'),
  })
}

function translateMeteringMode(value: string | undefined): string | undefined {
  return translateEnum(normalizeMeteringModeValue(value), {
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
  return translateEnum(normalizeWhiteBalanceValue(value), {
    auto: t('admin.upload.options.whiteBalance.auto'),
    manual: t('admin.upload.options.whiteBalance.manual'),
  })
}

function translateFlash(value: string | undefined): string | undefined {
  return translateEnum(normalizeFlashValue(value), {
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
    entries.push({ label: metadataLabels.value.title, value: title, icon: 'tabler:typography' })
  }
  const description = toDisplayText(file.description)
  if (description) {
    entries.push({ label: metadataLabels.value.description, value: description, icon: 'tabler:file-text' })
  }
  const fanworkTitle = toDisplayText(metadata.fanworkTitle || file.fanworkTitle)
  if (fanworkTitle) {
    entries.push({ label: metadataLabels.value.work, value: fanworkTitle, icon: 'tabler:palette' })
  }
  if (metadata.characters.length > 0) {
    entries.push({
      label: metadataLabels.value.characters,
      value: metadata.characters.join(characterSeparator.value),
      icon: 'tabler:users',
    })
  }
  const locationName = toDisplayText(metadata.locationName || file.location)
  if (locationName) {
    entries.push({ label: metadataLabels.value.location, value: locationName, icon: 'tabler:map-pin' })
  }
  const { camera, lens } = dedupeCameraLens(metadata.cameraModel || file.cameraModel, metadata.lensModel)
  if (camera) {
    const { model, brandIcon, brandLabel } = resolveCameraBrand(camera)
    entries.push({
      label: metadataLabels.value.camera,
      value: model ?? camera,
      icon: 'tabler:camera',
      valueIcon: brandIcon ?? undefined,
      valueIconLabel: brandLabel ?? undefined,
    })
  }
  if (lens) {
    entries.push({ label: metadataLabels.value.lens, value: lens, icon: 'tabler:aperture' })
  }
  const captureTime = formatDisplayDateTime(metadata.captureTime)
  if (captureTime) {
    entries.push({ label: metadataLabels.value.captureTime, value: captureTime, icon: 'tabler:clock' })
  }
  const colorSpace = toDisplayText(metadata.colorSpace)
  if (colorSpace) {
    entries.push({ label: metadataLabels.value.colorSpace, value: colorSpace, icon: 'tabler:palette' })
  }
  const resolution = formatResolutionValue(metadata.resolutionX, metadata.resolutionY, metadata.resolutionUnit)
  if (resolution) {
    entries.push({ label: metadataLabels.value.resolution, value: resolution, icon: 'tabler:crop' })
  }
  const software = toDisplayText(metadata.software)
  if (software) {
    entries.push({ label: metadataLabels.value.software, value: software, icon: 'tabler:app-window' })
  }
  return entries
})

const focusEntry = computed<MetadataEntry | null>(() => {
  const file = activeFile.value
  if (!file) {
    return null
  }
  const { metadata } = file
  const focusMode = toDisplayText(metadata.focusMode)
  const focusDistance = toDisplayText(metadata.focusDistance)
  if (!focusMode && !focusDistance) {
    return null
  }
  const focusValue = focusMode && focusDistance
    ? `${focusMode} (${focusDistance})`
    : (focusMode ?? focusDistance ?? '')
  return {
    key: 'focus',
    label: metadataLabels.value.focus,
    value: focusValue,
    icon: 'tabler:focus-2',
  }
})

const cropEntry = computed<MetadataEntry | null>(() => {
  const file = activeFile.value
  if (!file) {
    return null
  }
  const { metadata } = file
  const cropParts: string[] = []
  const cropRect = formatCropRectValue(metadata)
  if (cropRect) {
    cropParts.push(cropRect)
  }
  const cropAngle = formatCropAngleValue(metadata.cropAngle)
  if (cropAngle) {
    cropParts.push(`Rot ${cropAngle}`)
  }
  const perspective = formatPerspectiveValue(metadata)
  if (perspective) {
    cropParts.push(`P ${perspective}`)
  }
  if (cropParts.length === 0) {
    return null
  }
  return {
    key: 'crop',
    label: metadataLabels.value.crop,
    value: cropParts.join(' · '),
    icon: 'tabler:crop',
  }
})

const lightroomRecipe = computed<LightroomRecipeView | null>(() => {
  const file = activeFile.value
  if (!file) {
    return null
  }
  return parseLightroomRecipeView(file.metadata.lightroomRecipe)
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
      icon: 'tabler:aperture',
    })
  }
  const shutterSpeed = toDisplayText(metadata.shutterSpeed)
  if (shutterSpeed) {
    entries.push({
      label: t('gallery.metadata.shutterSpeed'),
      value: shutterSpeed,
      icon: 'tabler:hourglass',
    })
  }
  const iso = toDisplayText(metadata.iso)
  if (iso) {
    entries.push({
      label: t('gallery.metadata.iso'),
      value: iso,
      icon: 'tabler:circle-letter-i',
    })
  }
  const focalLength = toDisplayText(metadata.focalLength)
  if (focalLength) {
    entries.push({
      label: t('gallery.metadata.focalLength'),
      value: focalLength,
      icon: 'tabler:ruler',
    })
  }
  const exposureBias = toDisplayText(metadata.exposureBias)
  if (exposureBias) {
    entries.push({
      label: metadataLabels.value.exposureBias,
      value: exposureBias,
      icon: 'tabler:brightness-2',
    })
  }
  const exposureProgram = toDisplayText(metadata.exposureProgram)
  if (exposureProgram) {
    entries.push({
      label: metadataLabels.value.exposureProgram,
      value: translateExposureProgram(exposureProgram) ?? exposureProgram,
      icon: 'tabler:list-details',
    })
  }
  const exposureMode = toDisplayText(metadata.exposureMode)
  if (exposureMode) {
    entries.push({
      label: metadataLabels.value.exposureMode,
      value: translateExposureMode(exposureMode) ?? exposureMode,
      icon: 'tabler:adjustments',
    })
  }
  const meteringMode = toDisplayText(metadata.meteringMode)
  if (meteringMode) {
    entries.push({
      label: metadataLabels.value.meteringMode,
      value: translateMeteringMode(meteringMode) ?? meteringMode,
      icon: 'tabler:crosshair',
    })
  }
  const whiteBalance = toDisplayText(metadata.whiteBalance)
  if (whiteBalance) {
    entries.push({
      label: metadataLabels.value.whiteBalance,
      value: translateWhiteBalance(whiteBalance) ?? whiteBalance,
      icon: 'tabler:color-filter',
    })
  }
  const flash = toDisplayText(metadata.flash)
  if (flash) {
    entries.push({
      label: metadataLabels.value.flash,
      value: translateFlash(flash) ?? flash,
      icon: 'tabler:bolt',
    })
  }
  return entries
})

const hasMetadata = computed<boolean>(() =>
  metadataEntries.value.length > 0
  || exposureEntries.value.length > 0
  || focusEntry.value !== null
  || cropEntry.value !== null
  || lightroomRecipe.value !== null,
)

const overlayStats = computed<OverlayStat[]>(() => {
  const currentLocale = locale.value
  const file = activeFile.value
  if (!file) {
    return []
  }
  const stats: OverlayStat[] = []
  const resolution = `${file.width} × ${file.height}`
  stats.push({ label: resolution, icon: 'tabler:crop' })
  const sizeLabel = formatBytes(file.fileSize ?? null)
  stats.push({ label: sizeLabel, icon: 'tabler:database' })
  const uploadedAt = formatDisplayDateTime(file.createdAt)
  if (uploadedAt) {
    stats.push({ label: uploadedAt, icon: 'tabler:upload' })
  }
  const depthMapUrl = typeof file.metadata.depthMapUrl === 'string' ? file.metadata.depthMapUrl.trim() : ''
  if (depthMapUrl && currentLocale) {
    stats.push({ label: t('gallery.badges.depthMap'), icon: 'tabler:stack-2' })
  }
  return stats
})

const locationPoint = computed<FileLocation | null>(() => {
  const file = activeFile.value
  if (!file) {
    return null
  }
  const latitude = toNumericCoordinate(file.metadata.latitude)
  const longitude = toNumericCoordinate(file.metadata.longitude)
  if (latitude === null || longitude === null) {
    return null
  }
  return {
    latitude,
    longitude,
    label: toDisplayText(file.metadata.locationName || file.location) ?? t('gallery.map.defaultLabel'),
  }
})

function formatBytes(value: number | null): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return '0 MB'
  }
  const megabytes = value / (1024 * 1024)
  const precision = megabytes >= 10 ? 0 : 1
  return `${megabytes.toFixed(precision)} MB`
}

function resolveShareBaseName(file: ResolvedFile): string {
  const title = resolveFileTitle(file, `live-photo-${file.id}`)
  const normalized = title
    .normalize('NFKD')
    .replaceAll(/[^\w-]+/g, '-')
    .replaceAll(/-+/g, '-')
    .replaceAll(/^-|-$/g, '')
    .slice(0, 80)
  return normalized.length > 0 ? normalized : `live-photo-${file.id}`
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
  if (state.total === null || state.total <= 0) {
    return false
  }
  return state.status === 'loading' || state.status === 'done'
})

function updateOverlayViewerSize(): void {
  const viewer = overlayViewerRef.value
  if (!viewer) {
    overlayViewerSize.value = { width: 0, height: 0 }
    return
  }
  const width = viewer.clientWidth
  const height = viewer.clientHeight
  overlayViewerSize.value = {
    width: Number.isFinite(width) ? width : 0,
    height: Number.isFinite(height) ? height : 0,
  }
}

watch(
  overlayViewerRef,
  (next, _previous, onCleanup) => {
    overlayViewerResizeObserver.value?.disconnect()
    overlayViewerResizeObserver.value = null
    if (!next) {
      overlayViewerSize.value = { width: 0, height: 0 }
      return
    }
    updateOverlayViewerSize()
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => updateOverlayViewerSize())
      observer.observe(next)
      overlayViewerResizeObserver.value = observer
      onCleanup(() => observer.disconnect())
    }
  },
  { immediate: true },
)

const overlayBaseScale = computed<number>(() => {
  const file = activeFile.value
  const containerWidth = overlayViewerSize.value.width
  const containerHeight = overlayViewerSize.value.height
  if (!file || containerWidth <= 0 || containerHeight <= 0) {
    return 1
  }
  const naturalWidth = Number.isFinite(file.width) && file.width > 0 ? file.width : containerWidth
  const naturalHeight = Number.isFinite(file.height) && file.height > 0 ? file.height : containerHeight
  if (naturalWidth <= 0 || naturalHeight <= 0) {
    return 1
  }
  const scale = Math.min(containerWidth / naturalWidth, containerHeight / naturalHeight)
  if (!Number.isFinite(scale) || scale <= 0) {
    return 1
  }
  return scale
})

const overlayImageFitStyle = computed<CSSProperties>(() => {
  const file = activeFile.value
  const containerWidth = overlayViewerSize.value.width
  const containerHeight = overlayViewerSize.value.height
  if (!file || containerWidth <= 0 || containerHeight <= 0) {
    return {}
  }
  const imageWidth = Number.isFinite(file.width) && file.width > 0 ? file.width : 0
  const imageHeight = Number.isFinite(file.height) && file.height > 0 ? file.height : 0
  if (imageWidth <= 0 || imageHeight <= 0) {
    return {
      width: '100%',
      height: 'auto',
      maxWidth: '100%',
      maxHeight: '100%',
    }
  }
  const containerRatio = containerWidth / containerHeight
  const imageRatio = imageWidth / imageHeight
  if (!Number.isFinite(containerRatio) || containerRatio <= 0 || !Number.isFinite(imageRatio) || imageRatio <= 0) {
    return {}
  }
  if (imageRatio >= containerRatio) {
    return {
      width: '100%',
      height: 'auto',
      maxWidth: '100%',
      maxHeight: '100%',
    }
  }
  return {
    width: 'auto',
    height: '100%',
    maxWidth: '100%',
    maxHeight: '100%',
  }
})

const overlayZoomMin = computed<number>(() => {
  const base = overlayBaseScale.value
  if (!Number.isFinite(base) || base <= 0) {
    return 1
  }
  return Math.max(overlayZoomEpsilon, base)
})

const isOverlayInteractionDisabled = computed<boolean>(() => isSmallScreen.value)

const viewerTouchAction = computed<string>(() => {
  if (isOverlayInteractionDisabled.value) {
    return 'pan-y'
  }
  if (overlayZoom.value > overlayZoomMin.value + overlayZoomEpsilon || overlayPointers.value.size >= 2) {
    return 'none'
  }
  return 'pan-y pinch-zoom'
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

const overlayRouteId = computed<number | null>(() => getOverlayRouteIdFromRoute())

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
      return
    }
    if (activeFile.value !== target) {
      activeFile.value = target
      histogram.value = normalizeHistogram(target.metadata.histogram)
    }
  },
  { immediate: true },
)

watch(
  () => props.files.map(file => file.id),
  (ids) => {
    if (hiddenFileIds.value.size === 0) {
      return
    }
    const idSet = new Set(ids)
    const next = new Set<number>()
    for (const id of hiddenFileIds.value) {
      if (idSet.has(id)) {
        next.add(id)
      }
    }
    hiddenFileIds.value = next
  },
  { immediate: true },
)

watch(
  currentSeriesSlug,
  () => {
    hiddenFileIds.value = new Set()
  },
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

watch(
  [isSmallScreen, activeFile],
  ([isSmall, file], [previousIsSmall, previousFile]) => {
    if (!file || file !== previousFile || isSmall === previousIsSmall) {
      return
    }
    if (isSmall) {
      resetOverlayZoom()
    }
    startOverlayImageLoad(file, overlayImageSrc.value)
  },
)

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

function showOverlayZoomIndicator(sessionId: number): void {
  if (!isOverlaySessionActive(sessionId)) {
    return
  }
  overlayZoomIndicatorVisible.value = true
  clearOverlayZoomIndicatorTimer()
  overlayZoomIndicatorTimer.value = setTimeout(() => {
    if (!isOverlaySessionActive(sessionId)) {
      overlayZoomIndicatorTimer.value = null
      return
    }
    overlayZoomIndicatorVisible.value = false
    overlayZoomIndicatorTimer.value = null
  }, overlayZoomIndicatorDurationMs)
}

function scheduleOverlayDownloadReset(sessionId: number): void {
  if (!isOverlaySessionActive(sessionId)) {
    return
  }
  clearOverlayDownloadHideTimer()
  overlayDownloadHideTimer.value = setTimeout(() => {
    if (!isOverlaySessionActive(sessionId)) {
      overlayDownloadHideTimer.value = null
      return
    }
    overlayDownloadState.value = {
      status: 'idle',
      loaded: 0,
      total: null,
    }
    overlayDownloadHideTimer.value = null
  }, overlayDownloadHideDelayMs)
}

function markOverlayDownloadDone(loaded: number, total: number | null, sessionId: number): void {
  if (!isOverlaySessionActive(sessionId)) {
    return
  }
  overlayDownloadState.value = { status: 'done', loaded, total }
  scheduleOverlayDownloadReset(sessionId)
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
  showOverlayZoomIndicator(overlaySessionId.value)
}

function handleOverlayWheel(event: WheelEvent): void {
  if (!activeFile.value || isOverlayInteractionDisabled.value) {
    return
  }
  event.preventDefault()
  const direction = event.deltaY > 0 ? -overlayZoomStep : overlayZoomStep
  setOverlayZoom(overlayZoom.value + direction, { clientX: event.clientX, clientY: event.clientY })
}

function handleOverlayDoubleClick(event: MouseEvent): void {
  if (isOverlayInteractionDisabled.value) {
    return
  }
  event.preventDefault()
  const isAtOriginal = Math.abs(overlayZoom.value - 1) <= overlayZoomEpsilon
  const target = isAtOriginal ? overlayZoomMin.value : 1
  const focal = target > overlayZoomMin.value + overlayZoomEpsilon
    ? { clientX: event.clientX, clientY: event.clientY }
    : undefined
  setOverlayZoom(target, focal)
}

function handleOverlayPointerDown(event: PointerEvent): void {
  if (isOverlayInteractionDisabled.value) {
    return
  }
  if (!(event.currentTarget instanceof HTMLElement)) {
    return
  }
  overlayPointers.value.set(event.pointerId, { x: event.clientX, y: event.clientY })

  if (overlayPointers.value.size >= 2) {
    event.preventDefault()
    const points = [...overlayPointers.value.values()]
    const first = points[0]
    const second = points[1]
    if (!first || !second) {
      return
    }
    const distance = Math.hypot(second.x - first.x, second.y - first.y)
    overlayPinchBase.value = {
      distance: Math.max(distance, 0),
      zoom: overlayZoom.value,
    }
    overlayDragState.value = {
      pointerId: null,
      startX: 0,
      startY: 0,
      originX: 0,
      originY: 0,
    }
    return
  }

  if (overlayZoom.value <= overlayZoomMin.value + overlayZoomEpsilon) {
    overlayDragState.value = {
      pointerId: null,
      startX: 0,
      startY: 0,
      originX: 0,
      originY: 0,
    }
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
  if (isOverlayInteractionDisabled.value) {
    return
  }
  if (overlayPointers.value.has(event.pointerId)) {
    overlayPointers.value.set(event.pointerId, { x: event.clientX, y: event.clientY })
  }

  if (overlayPointers.value.size >= 2 && overlayPinchBase.value) {
    const points = [...overlayPointers.value.values()]
    const first = points[0]
    const second = points[1]
    if (!first || !second) {
      return
    }
    const distance = Math.hypot(second.x - first.x, second.y - first.y)
    if (distance > 0 && overlayPinchBase.value.distance > 0) {
      const centerX = (first.x + second.x) / 2
      const centerY = (first.y + second.y) / 2
      const ratio = distance / overlayPinchBase.value.distance
      const nextZoom = Math.min(overlayZoomMax, Math.max(overlayZoomMin.value, overlayPinchBase.value.zoom * ratio))
      setOverlayZoom(nextZoom, { clientX: centerX, clientY: centerY })
    }
    return
  }

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
  if (isOverlayInteractionDisabled.value) {
    return
  }
  if (overlayPointers.value.has(event.pointerId)) {
    overlayPointers.value.delete(event.pointerId)
  }
  if (overlayPointers.value.size < 2) {
    overlayPinchBase.value = null
  }

  if (event.currentTarget instanceof HTMLElement) {
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const state = overlayDragState.value
  if (state.pointerId === null || state.pointerId !== event.pointerId) {
    return
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

function startOverlayImageLoad(
  file: ResolvedFile,
  immediateSrc: string | null = null,
): void {
  const sessionId = overlaySessionId.value
  const isSessionActive = (): boolean => isOverlaySessionActive(sessionId)
  abortOverlayImageFetch()
  revokeOverlayObjectUrl()
  resetOverlayDownload()
  overlayImageLoader.value = null
  const previewSrc = file.previewAttrs?.src || file.previewUrl || file.coverUrl || file.imageUrl
  const rawFullImageSrc = file.imageUrl || previewSrc
  const targetWidth = isSmallScreen.value ? resolveOverlayTargetWidth(file, overlayMobileScale) : null
  const fullImageSrc = resolveOverlayFullImageSrc(rawFullImageSrc, targetWidth)
  const firstAvailable = [
    immediateSrc,
    file.placeholder,
    file.overlayPlaceholderUrl,
    file.previewAttrs?.src,
    file.previewUrl,
    file.coverUrl,
    file.imageAttrs?.src,
    file.imageUrl,
  ].find(value => typeof value === 'string' && value.trim().length > 0)?.trim()
  overlayImageSrc.value = firstAvailable || previewSrc
  if (typeof Image === 'undefined') {
    overlayImageSrc.value = fullImageSrc || overlayImageSrc.value
    return
  }

  const applyBlobSrc = (blob: Blob): void => {
    if (!isSessionActive() || overlayImageAbortController.value?.signal.aborted) {
      return
    }
    revokeOverlayObjectUrl()
    const objectUrl = URL.createObjectURL(blob)
    overlayImageObjectUrl.value = objectUrl
    overlayImageSrc.value = objectUrl
  }

  const startFullLoad = async (): Promise<void> => {
    if (!isSessionActive()) {
      return
    }
    if (!fullImageSrc) {
      return
    }
    if (typeof fetch === 'undefined' || !isCorsFetchableUrl(fullImageSrc)) {
      if (!isSessionActive()) {
        return
      }
      overlayImageSrc.value = fullImageSrc
      markOverlayDownloadDone(0, null, sessionId)
      return
    }
    const controller = new AbortController()
    overlayImageAbortController.value = controller
    if (!isSessionActive()) {
      controller.abort()
      if (overlayImageAbortController.value === controller) {
        overlayImageAbortController.value = null
      }
      return
    }
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
        markOverlayDownloadDone(blob.size, total ?? blob.size, sessionId)
        applyBlobSrc(blob)
        return
      }
      const reader = response.body.getReader()
      const chunks: ArrayBuffer[] = []
      let loaded = 0
      if (!isSessionActive()) {
        await reader.cancel()
        return
      }
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
          if (!isSessionActive()) {
            await reader.cancel()
            return
          }
          overlayDownloadState.value = { status: 'loading', loaded, total }
        }
      }
      const blob = new Blob(chunks, { type: response.headers.get('content-type') ?? 'image/jpeg' })
      markOverlayDownloadDone(blob.size, total ?? blob.size, sessionId)
      applyBlobSrc(blob)
    }
    catch {
      if (controller.signal.aborted) {
        return
      }
      if (!isSessionActive()) {
        return
      }
      overlayDownloadState.value = { status: 'error', loaded: 0, total: null }
      overlayImageSrc.value = rawFullImageSrc || fullImageSrc
    }
    finally {
      overlayImageAbortController.value = null
    }
  }

  if (!previewSrc || previewSrc === fullImageSrc || previewSrc === overlayImageSrc.value) {
    void startFullLoad()
    return
  }

  if (overlayImageSrc.value && previewSrc === overlayImageSrc.value) {
    void startFullLoad()
    return
  }

  const previewLoader = new Image()
  overlayImageLoader.value = previewLoader
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
</script>

<template>
  <div ref="galleryRef" class="relative">
    <template v-if="!showLoadingState">
      <Waterfall
        :gap="waterfallGap"
        :range-expand="300"
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
            class="group relative block h-full w-full overflow-hidden bg-default focus:outline-none"
            :style="entry.placeholder && !isEntryLoaded(entry.id)
              ? {
                backgroundImage: `url('${entry.placeholder}')`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
              }
              : undefined"
            :aria-label="t('gallery.viewLarge', { title: entry.displayTitle })"
            @click="handleEntryClick($event, entry)"
            @mouseenter="handleLivePreviewEnter(entry)"
            @mouseleave="handleLivePreviewLeave(entry)"
          >
            <!--
              Three-layer reveal: a static background-image placeholder (SSR
              / pre-wasm fallback), an inline arthash SVG whose 64 rects fade
              out one-by-one once the full image decodes, and the image
              itself. Cached images that bypass the load event are caught in
              onEntryImageRef.
            -->
            <img
              :key="entry.id"
              :ref="el => onEntryImageRef(entry.id, el as Element | null)"
              :alt="entry.displayTitle"
              :style="entryTransitionStyle(entry.id)"
              loading="lazy"
              decoding="async"
              class="h-full w-full object-contain transition-opacity group-hover:opacity-90"
              v-bind="entry.imageAttrs"
              @load="markEntryLoaded(entry.id)"
            >
            <ArthashPlaceholder
              :arthash="entry.metadata.arthash"
              :loaded="isEntryLoaded(entry.id)"
            />
            <video
              v-if="entry.metadata.livePhotoVideoUrl"
              :ref="element => setLivePreviewRef(entry.id, element)"
              :src="entry.metadata.livePhotoVideoUrl"
              :poster="entry.imageAttrs?.src ?? entry.imageUrl"
              class="pointer-events-none absolute inset-0 h-full w-full object-contain transition-opacity duration-200"
              :class="livePreviewPlaying[entry.id] ? 'opacity-100' : 'opacity-0'"
              muted
              playsinline
              preload="metadata"
              @ended="handleLivePreviewEnded(entry.id)"
            />
            <span
              v-if="entry.metadata.livePhotoVideoUrl"
              class="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-default/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-highlighted ring-1 ring-default/60"
            >
              <Icon name="tabler:live-photo" class="h-4 w-4 text-primary" />
              <span>{{ t('gallery.livePhoto.badge') }}</span>
            </span>
          </button>
        </template>
      </Waterfall>
      <Teleport to="body">
        <WaterfallOverlay
          v-if="activeFile"
          :file="activeFile"
          :overlay-background-style="overlayBackgroundStyle"
          :overlay-image-src="overlayImageSrc || activeFile.previewUrl || activeFile.coverUrl || activeFile.imageUrl"
          :overlay-image-fit-style="overlayImageFitStyle"
          :overlay-image-transform-style="overlayImageTransformStyle"
          :overlay-download-visible="overlayDownloadVisible"
          :overlay-download-label="overlayDownloadLabel"
          :overlay-download-percent="overlayDownloadPercent"
          :overlay-zoom-label="overlayZoomLabel"
          :overlay-zoom-indicator-visible="overlayZoomIndicatorVisible"
          :overlay-stats="overlayStats"
          :histogram="histogram"
          :metadata-entries="metadataEntries"
          :focus-entry="focusEntry"
          :crop-entry="cropEntry"
          :lightroom-recipe="lightroomRecipe"
          :exposure-entries="exposureEntries"
          :has-metadata="hasMetadata"
          :preview-image-src="overlayPreviewSrc"
          :preview-enabled="isSmallScreen"
          :overlay-image-ready="overlayImageReady"
          :location="locationPoint"
          :genre-label="genreBadgeLabel"
          :can-edit="isAdmin"
          :viewer-touch-action="viewerTouchAction"
          :live-photo-sharing="sharingLivePhoto"
          :live-photo-preparing="preparingLivePhotoShare"
          @close="handleOverlayClose"
          @edit="handleOverlayEdit"
          @share-live-photo="handleShareLivePhoto"
          @wheel="handleOverlayWheel"
          @dblclick="handleOverlayDoubleClick"
          @pointerdown="handleOverlayPointerDown"
          @pointermove="handleOverlayPointerMove"
          @pointerup="endOverlayPointerDrag"
          @pointercancel="endOverlayPointerDrag"
          @pointerleave="endOverlayPointerDrag"
          @viewer-mounted="handleOverlayViewerMounted"
        />
        <AdminEditModal
          v-model:open="editModalOpen"
          v-model:capture-time-local="editCaptureTimeLocal"
          v-model:form="editFormModel"
          v-model:series-ids="editSeriesIds"
          v-model:replace-file="replaceFile"
          :file="editingFile"
          :loading="editing"
          :enable-depth-action="isAdmin"
          :depth-processing="editingFile ? depthProcessing[editingFile.id] : false"
          :classify-source="{ imageUrl: editingFile?.imageUrl || '' }"
          @submit="saveEditFromModal"
          @close="closeEditModal"
          @generate-depth="generateDepthMapFromEdit"
        />
      </Teleport>
    </template>
    <div
      v-else
      class="flex items-center justify-center text-sm text-muted"
      :style="{ height: 'calc(100dvh - 256px)' }"
      aria-live="polite"
      aria-busy="true"
    >
      <div class="flex flex-col items-center gap-2">
        <Icon name="tabler:loader-2" class="animate-spin" size="xl" />
        <span class="text-sm text-muted">
          {{ t('home.loading') }}
        </span>
      </div>
    </div>
  </div>
</template>
