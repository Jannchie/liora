<script setup lang="ts">
import type { CSSProperties } from 'vue'
import type { MediaFormState } from '~/types/admin'
import type { FileResponse, HistogramData } from '~/types/file'
import type {
  DisplaySize,
  FileLocation,
  ImageAttrs,
  MetadataEntry,
  OverlayStat,
  ResolvedFile,
  SiteInfoPlacement,
  SocialLink,
  WaterfallEntry,
} from '~/types/gallery'
import type { SiteSettings } from '~/types/site'
import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'
import { thumbHashToApproximateAspectRatio, thumbHashToDataURL } from 'thumbhash'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, unref, watch } from 'vue'
import { Waterfall } from 'vue-wf'
import { useFileEditApi } from '~/composables/useFileEditApi'
import { brandIconSet } from '~/constants/brand-icons'
import { toLocalInputString } from '~/utils/datetime'
import { resolveFileTitle } from '~/utils/file'

const props = withDefaults(
  defineProps<{
    files: FileResponse[]
    isLoading: boolean
    emptyText?: string
    scrollElement?: HTMLElement
    siteSettings?: SiteSettings | null
    isAuthenticated?: boolean
  }>(),
  {
    emptyText: undefined,
    scrollElement: undefined,
    siteSettings: undefined,
    isAuthenticated: false,
  },
)

const { t, locale } = useI18n()
const toast = useToast()
const { updateFile } = useFileEditApi()

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
const overlayPointers = ref<Map<number, { x: number, y: number }>>(new Map())
const overlayPinchBase = ref<{ distance: number, zoom: number } | null>(null)

const fileOverrides = ref<Record<number, FileResponse>>({})
const isAdmin = computed(() => props.isAuthenticated ?? false)
const filesWithOverrides = computed<FileResponse[]>(() => props.files.map(file => fileOverrides.value[file.id] ?? file))

interface ThumbhashInfo {
  dataUrl: string
  aspectRatio: number
}

type OverlayDownloadStatus = 'idle' | 'loading' | 'done' | 'error'

interface OverlayDownloadState {
  status: OverlayDownloadStatus
  loaded: number
  total: number | null
}

const baseRouteName = 'index'
const overlayRouteParam = 'rest'

interface OverlayPointer {
  clientX: number
  clientY: number
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
  const imageResult = image.getImage(src, {
    modifiers,
  })
  const resolvedSrc = sizes.src ?? imageResult.url

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

function toResolvedFile(file: FileResponse, displayWidth: number): ResolvedFile {
  const displayTitle = resolveFileTitle(file, untitledLabel.value)
  const decoded = decodeThumbhash(file.metadata.thumbhash)
  const displaySize = computeDisplaySize(file, decoded?.aspectRatio, displayWidth)
  const imageUrl = (file.imageUrl ?? '').trim()
  const thumbnailUrl = (file.thumbnailUrl ?? '').trim()
  const baseImageUrl = thumbnailUrl.length > 0 ? thumbnailUrl : imageUrl
  const imageAttrs = resolveImageAttrs(baseImageUrl, displaySize, 'inside')
  const previewSize = computeDisplaySize(
    file,
    decoded?.aspectRatio,
    displayWidth,
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
}

const resolvedFiles = computed<ResolvedFile[]>(() => {
  const displayWidth = columnWidth.value
  return [...filesWithOverrides.value]
    .map(file => toResolvedFile(file, displayWidth))
    .toSorted((first, second) => resolveSortTimestamp(second) - resolveSortTimestamp(first))
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

  appendLink('Homepage', social.homepage, 'mdi:home')
  appendLink('GitHub', social.github, 'mdi:github')
  appendLink('X', social.twitter, 'fa6-brands:x-twitter')
  appendLink('Instagram', social.instagram, 'mdi:instagram')
  appendLink('YouTube', social.youtube, 'mdi:youtube')
  appendLink('TikTok', social.tiktok, 'fa6-brands:tiktok')
  appendLink('Bilibili', social.bilibili, 'simple-icons:bilibili')
  appendLink('LinkedIn', social.linkedin, 'mdi:linkedin')
  appendLink('Weibo', social.weibo, 'mdi:sina-weibo')
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
    const target = Math.max(minColumns, Math.ceil(width / maxDisplayWidth))
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

function resolveOverlayRouteIdFromPathParam(): number | null {
  const param = route.params[overlayRouteParam]
  const normalized = Array.isArray(param)
    ? param.join('/')
    : (typeof param === 'string'
        ? param
        : '')
  if (normalized.length === 0) {
    return null
  }
  const match = normalized.match(/^photo\/(\d+)$/)
  if (!match) {
    return null
  }
  return resolveOverlayRouteId(match[1])
}

function getOverlayRouteIdFromRoute(): number | null {
  return resolveOverlayRouteIdFromPathParam()
}

async function syncOverlayRoute(fileId: number | null, navigation: 'push' | 'replace' = 'push'): Promise<void> {
  const navigate = navigation === 'replace' ? router.replace : router.push
  const nextQuery = { ...route.query }
  const currentId = getOverlayRouteIdFromRoute()
  if (fileId === null && currentId === null && route.path === '/') {
    return
  }
  if (fileId !== null && currentId === fileId && route.path === `/photo/${fileId}`) {
    return
  }
  if (fileId === null) {
    await navigate({ name: baseRouteName, query: nextQuery, hash: route.hash })
    return
  }
  await navigate({
    path: `/photo/${fileId}`,
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
  const fallback = file.imageAttrs?.src ?? file.thumbnailUrl ?? ''
  const normalized = fallback.trim()
  return normalized.length > 0 ? normalized : null
}

function openOverlay(file: ResolvedFile, syncRoute: boolean = true, immediateSrc: string | null = null): void {
  activeFile.value = file
  void nextTick(() => resetOverlayZoom())
  startOverlayImageLoad(file, immediateSrc)
  const cachedHistogram = normalizeHistogram(file.metadata.histogram)
  histogram.value = cachedHistogram
  if (syncRoute) {
    void syncOverlayRoute(file.id, 'push')
  }
}

function closeOverlay(syncRoute: boolean = true): void {
  activeFile.value = null
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
const editCaptureTimeLocal = ref<string>('')
const replaceFile = ref<File | null>(null)
const editForm = reactive<MediaFormState>({
  title: '',
  description: '',
  genre: '',
  width: 0,
  height: 0,
  fanworkTitle: '',
  characters: [],
  location: '',
  locationName: '',
  latitude: null,
  longitude: null,
  cameraModel: '',
  lensModel: '',
  aperture: '',
  focalLength: '',
  iso: '',
  shutterSpeed: '',
  exposureBias: '',
  exposureProgram: '',
  exposureMode: '',
  meteringMode: '',
  whiteBalance: '',
  flash: '',
  colorSpace: '',
  resolutionX: '',
  resolutionY: '',
  resolutionUnit: '',
  software: '',
  captureTime: '',
  notes: '',
})
const editFormModel = computed<MediaFormState>({
  get: () => editForm,
  set: (value) => {
    Object.assign(editForm, value)
  },
})

const editToastMessages = computed(() => ({
  updateFailed: t('admin.files.toast.updateFailed'),
  updateFailedFallback: t('admin.files.toast.updateFailedFallback'),
}))

function resetEditForm(): void {
  editForm.title = ''
  editForm.description = ''
  editForm.genre = ''
  editForm.width = 0
  editForm.height = 0
  editForm.fanworkTitle = ''
  editForm.characters = []
  editForm.location = ''
  editForm.locationName = ''
  editForm.latitude = null
  editForm.longitude = null
  editForm.cameraModel = ''
  editForm.lensModel = ''
  editForm.aperture = ''
  editForm.focalLength = ''
  editForm.iso = ''
  editForm.shutterSpeed = ''
  editForm.exposureBias = ''
  editForm.exposureProgram = ''
  editForm.exposureMode = ''
  editForm.meteringMode = ''
  editForm.whiteBalance = ''
  editForm.flash = ''
  editForm.colorSpace = ''
  editForm.resolutionX = ''
  editForm.resolutionY = ''
  editForm.resolutionUnit = ''
  editForm.software = ''
  editForm.captureTime = ''
  editCaptureTimeLocal.value = ''
  editForm.notes = ''
  replaceFile.value = null
}

function fillEditForm(file: FileResponse): void {
  const metadata = file.metadata
  resetEditForm()
  editForm.title = file.title ?? ''
  editForm.description = file.description ?? ''
  editForm.genre = file.genre || ''
  editForm.width = file.width
  editForm.height = file.height
  editForm.fanworkTitle = metadata.fanworkTitle || file.fanworkTitle || ''
  editForm.characters = metadata.characters ?? file.characters ?? []
  editForm.location = metadata.location || file.location || ''
  editForm.locationName = metadata.locationName
  editForm.latitude = metadata.latitude
  editForm.longitude = metadata.longitude
  editForm.cameraModel = metadata.cameraModel || file.cameraModel || ''
  editForm.lensModel = metadata.lensModel || ''
  editForm.aperture = metadata.aperture || ''
  editForm.focalLength = metadata.focalLength || ''
  editForm.iso = metadata.iso || ''
  editForm.shutterSpeed = metadata.shutterSpeed || ''
  editForm.exposureBias = metadata.exposureBias || ''
  editForm.exposureProgram = metadata.exposureProgram || ''
  editForm.exposureMode = metadata.exposureMode || ''
  editForm.meteringMode = metadata.meteringMode || ''
  editForm.whiteBalance = metadata.whiteBalance || ''
  editForm.flash = metadata.flash || ''
  editForm.colorSpace = metadata.colorSpace || ''
  editForm.resolutionX = metadata.resolutionX || ''
  editForm.resolutionY = metadata.resolutionY || ''
  editForm.resolutionUnit = metadata.resolutionUnit || ''
  editForm.software = metadata.software || ''
  editForm.captureTime = metadata.captureTime || ''
  editCaptureTimeLocal.value = editForm.captureTime ? toLocalInputString(editForm.captureTime) : ''
  editForm.notes = metadata.notes || ''
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
  closeOverlay()
}

function closeEditModal(): void {
  editModalOpen.value = false
  editingFile.value = null
  replaceFile.value = null
}

async function saveEditFromModal(): Promise<void> {
  if (!editingFile.value) {
    return
  }
  editing.value = true
  try {
    const updated = await updateFile(
      editingFile.value.id,
      editForm,
      replaceFile.value,
      editingFile.value.width,
      editingFile.value.height,
    )
    fileOverrides.value = { ...fileOverrides.value, [updated.id]: updated }
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
    const { model, brandIcon, brandLabel } = resolveCameraBrand(camera)
    entries.push({
      label: metadataLabels.value.camera,
      value: model ?? camera,
      icon: 'carbon:camera',
      valueIcon: brandIcon ?? undefined,
      valueIconLabel: brandLabel ?? undefined,
    })
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
  const sizeLabel = formatBytes(file.fileSize ?? null)
  stats.push({ label: sizeLabel, icon: 'carbon:data-volume' })
  const uploadedAt = formatDisplayDateTime(file.createdAt)
  if (uploadedAt) {
    stats.push({ label: uploadedAt, icon: 'carbon:upload' })
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
      || file.thumbnailUrl
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
    }
  },
  { immediate: true },
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
  ([
    isSmall, 
file,
  ], [
    previousIsSmall, 
previousFile,
  ]) => {
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

function startOverlayImageLoad(file: ResolvedFile, immediateSrc: string | null = null): void {
  abortOverlayImageFetch()
  revokeOverlayObjectUrl()
  resetOverlayDownload()
  overlayImageLoader.value = null
  const skipFullLoad = isSmallScreen.value
  const previewSrc = file.previewAttrs?.src || file.previewUrl || file.coverUrl || file.thumbnailUrl || file.imageUrl
  const rawFullImageSrc = file.imageUrl || file.thumbnailUrl || previewSrc
  const fullImageSrc = resolveCorsSafeUrl(rawFullImageSrc) ?? rawFullImageSrc
  const firstAvailable = [
    immediateSrc,
    file.placeholder,
    file.overlayPlaceholderUrl,
    file.previewAttrs?.src,
    file.previewUrl,
    file.coverUrl,
    file.thumbnailUrl,
    file.imageAttrs?.src,
    file.imageUrl,
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
    if (skipFullLoad) {
      return
    }
    if (!fullImageSrc) {
      return
    }
    if (typeof fetch === 'undefined' || !isCorsFetchableUrl(fullImageSrc)) {
      overlayImageSrc.value = fullImageSrc
      markOverlayDownloadDone(0, null)
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
      overlayImageSrc.value = rawFullImageSrc || fullImageSrc
    }
    finally {
      overlayImageAbortController.value = null
    }
  }

  if (!previewSrc || previewSrc === fullImageSrc || previewSrc === overlayImageSrc.value) {
    if (skipFullLoad) {
      return
    }
    void startFullLoad()
    return
  }

  if (overlayImageSrc.value && previewSrc === overlayImageSrc.value) {
    if (skipFullLoad) {
      return
    }
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
    if (skipFullLoad) {
      return
    }
    void startFullLoad()
  }
  const handlePreviewError = (): void => {
    if (overlayImageLoader.value !== previewLoader) {
      return
    }
    overlayImageLoader.value = null
    if (skipFullLoad) {
      return
    }
    void startFullLoad()
  }
  previewLoader.addEventListener('load', handlePreviewLoad)
  previewLoader.addEventListener('error', handlePreviewError)
  previewLoader.src = previewSrc
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
        <Icon name="line-md:loading-loop" class="h-5 w-5 text-primary" />
        <span>{{ loadingText }}</span>
      </div>
    </div>
    <Teleport to="body">
      <WaterfallOverlay
        v-if="activeFile"
        :file="activeFile"
        :overlay-background-style="overlayBackgroundStyle"
        :overlay-image-src="overlayImageSrc || activeFile.previewUrl || activeFile.coverUrl || activeFile.imageUrl"
        :overlay-image-transform-style="overlayImageTransformStyle"
        :overlay-download-visible="overlayDownloadVisible"
        :overlay-download-label="overlayDownloadLabel"
        :overlay-download-percent="overlayDownloadPercent"
        :overlay-zoom-label="overlayZoomLabel"
        :overlay-zoom-indicator-visible="overlayZoomIndicatorVisible"
        :overlay-stats="overlayStats"
        :histogram="histogram"
        :metadata-entries="metadataEntries"
        :exposure-entries="exposureEntries"
        :has-metadata="hasMetadata"
        :preview-attrs="activeFile.previewAttrs"
        :location="locationPoint"
        :genre-label="genreBadgeLabel"
        :can-edit="isAdmin"
        :viewer-touch-action="viewerTouchAction"
        @close="handleOverlayClose"
        @edit="handleOverlayEdit"
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
        v-model:replace-file="replaceFile"
        :file="editingFile"
        :loading="editing"
        :classify-source="{ imageUrl: editingFile?.imageUrl || '' }"
        @submit="saveEditFromModal"
        @close="closeEditModal"
      />
    </Teleport>
  </div>
  <div
    v-else
    class="flex min-h-[50vh] items-center justify-center text-sm text-muted"
    aria-live="polite"
  >
    <Icon name="line-md:loading-loop" class="mr-2 h-5 w-5 text-primary" />
    <span>Loading gallery…</span>
  </div>
</template>
