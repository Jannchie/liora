<script setup lang="ts">
import type { MediaFormState } from '~/types/admin'
import type { UploadProcessingStatus } from '~/types/file'
import exifr from 'exifr'
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useExposureOptions } from '~/composables/useExposureOptions'
import { toLocalInputString } from '~/utils/datetime'

const { t } = useI18n()
const toast = useToast()
const requestFetch = useRequestFetch()
definePageMeta({
  middleware: 'admin-auth',
})

const pageTitle = computed(() => t('admin.upload.seoTitle'))
const pageDescription = computed(() => t('admin.upload.seoDescription'))

const toastMessages = computed(() => ({
  selectImage: t('admin.upload.toast.selectImage'),
  selectVideo: t('admin.upload.toast.selectVideo'),
  selectFrame: t('admin.upload.toast.selectFrame'),
  readSize: t('admin.upload.toast.readSize'),
  sizeFailed: t('admin.upload.toast.sizeFailed'),
  sizeFailedFallback: t('admin.upload.toast.sizeFailedFallback'),
  exifFailed: t('admin.upload.toast.exifFailed'),
  exifFailedFallback: t('admin.upload.toast.exifFailedFallback'),
  videoFailed: t('admin.upload.toast.videoFailed'),
  frameFailed: t('admin.upload.toast.frameFailed'),
  saveFailedTitle: t('admin.upload.toast.saveFailedTitle'),
  saveFailedFallback: t('admin.upload.toast.saveFailedFallback'),
  geocodeMissingQuery: t('admin.upload.toast.geocodeMissingQuery'),
  geocodeFailedTitle: t('admin.upload.toast.geocodeFailedTitle'),
  geocodeFailedFallback: t('admin.upload.toast.geocodeFailedFallback'),
  geocodeNoResult: t('admin.upload.toast.geocodeNoResult'),
  processing: t('admin.upload.toast.processing'),
  processingDescription: t('admin.upload.toast.processingDescription'),
  processingDoneTitle: t('admin.upload.toast.processingDoneTitle'),
  processingDoneDescription: t('admin.upload.toast.processingDoneDescription'),
  processingFailedTitle: t('admin.upload.toast.processingFailedTitle'),
  processingFailedDescription: t('admin.upload.toast.processingFailedDescription'),
}))

useSeoMeta({
  title: () => pageTitle.value,
  ogTitle: () => pageTitle.value,
  description: () => pageDescription.value,
  ogDescription: () => pageDescription.value,
  robots: 'noindex, nofollow',
})

type UploadValue = File | null
type UploadMode = 'image' | 'live'

const previewMaxHeight = 480
const uploadMode = ref<UploadMode>('image')
const uploadValue = ref<UploadValue>(null)
const videoValue = ref<File | null>(null)
const videoPreviewUrl = ref<string>('')
const liveFrameTime = ref(0)
const liveFrameDuration = ref(0)
const liveFramePending = ref(false)
const videoElementRef = ref<HTMLVideoElement | null>(null)
const form = reactive<MediaFormState>({
  width: 0,
  height: 0,
  title: '',
  description: '',
  genre: '',
  fanworkTitle: '',
  characters: [],
  location: '',
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
  locationName: '',
  latitude: null as number | null,
  longitude: null as number | null,
  notes: '',
})
const formModel = computed<MediaFormState>({
  get: () => form,
  set: (value) => {
    Object.assign(form, value)
  },
})

const submitting = ref(false)
const uploadProgress = ref(0)
const uploadSpeed = ref(0)
const uploadBytesSent = ref(0)
const uploadTotalBytes = ref(0)
const uploadStartedAt = ref<number | null>(null)
const selectedFile = computed<File | null>(() => {
  return uploadValue.value ?? null
})
const selectedVideo = computed<File | null>(() => videoValue.value ?? null)
const hasSelection = computed<boolean>(() => Boolean(selectedFile.value || selectedVideo.value))
const isLiveMode = computed<boolean>(() => uploadMode.value === 'live')
const previewUrl = ref<string>('')
const fileUploadRef = ref<{ inputRef?: HTMLInputElement | { value?: unknown } } | null>(null)
const videoUploadRef = ref<{ inputRef?: HTMLInputElement | { value?: unknown } } | null>(null)
const aspectRatioStyle = computed(() => (form.width > 0 && form.height > 0 ? `${form.width} / ${form.height}` : '4 / 3'))
const captureTimeLocal = ref<string>('')
const captureTimeDisplay = computed(() => {
  if (!captureTimeLocal.value) {
    return ''
  }
  const parsed = new Date(captureTimeLocal.value)
  if (Number.isNaN(parsed.getTime())) {
    return ''
  }
  return parsed.toLocaleString()
})
let pasteListener: ((event: ClipboardEvent) => void) | null = null
const {
  exposureProgramOptions,
  exposureModeOptions,
  meteringModeOptions,
  whiteBalanceOptions,
  flashOptions,
} = useExposureOptions()
const selectedFileName = computed(() => selectedFile.value?.name ?? t('common.labels.untitled'))
const selectedVideoName = computed(() => selectedVideo.value?.name ?? t('common.labels.untitled'))
const displayFileName = computed(() => {
  if (isLiveMode.value && selectedVideo.value) {
    return selectedVideoName.value
  }
  return selectedFileName.value
})
const changePrimaryLabel = computed(() => (isLiveMode.value ? t('common.actions.changeVideo') : t('common.actions.changeImage')))
const totalUploadBytes = computed(() => (selectedFile.value?.size ?? 0) + (selectedVideo.value?.size ?? 0))
const uploadProgressPercent = computed(() => Math.min(100, Math.max(0, uploadProgress.value)))
const uploadSpeedText = computed(() => formatSpeed(uploadSpeed.value))
const uploadTotalText = computed(() => formatFileSize(uploadTotalBytes.value))
const uploadedBytesText = computed(() => formatFileSize(uploadBytesSent.value))
const isUploading = computed(() => submitting.value)
let activeMetadataToken = 0
const processingToastId = ref<string | null>(null)
const processingPollTimer = ref<ReturnType<typeof setInterval> | null>(null)
const liveFrameTimeLabel = computed(() => formatDuration(liveFrameTime.value))
const liveFrameDurationLabel = computed(() => formatDuration(liveFrameDuration.value))

function normalizeToOption(
  value: string | undefined,
  options: { label: string, value: string }[],
  aliases: Record<string, string> = {},
): string {
  const normalized = value?.trim()
  if (!normalized) {
    return ''
  }
  const lower = normalized.toLowerCase()
  const alias = aliases[lower]
  if (alias) {
    return alias
  }
  const exact = options.find(option => option.value.toLowerCase() === lower)
  if (exact) {
    return exact.value
  }
  for (const [key, mapped] of Object.entries(aliases)) {
    if (lower.includes(key)) {
      return mapped
    }
  }
  const partial = options.find(option => lower.includes(option.value.toLowerCase()))
  if (partial) {
    return partial.value
  }
  return normalized
}

function resetOptionalFields(): void {
  form.title = ''
  form.description = ''
  form.genre = ''
  form.fanworkTitle = ''
  form.characters = []
  form.location = ''
  form.locationName = ''
  form.latitude = null
  form.longitude = null
  form.cameraModel = ''
  form.lensModel = ''
  form.aperture = ''
  form.focalLength = ''
  form.iso = ''
  form.shutterSpeed = ''
  form.exposureBias = ''
  form.exposureProgram = ''
  form.exposureMode = ''
  form.meteringMode = ''
  form.whiteBalance = ''
  form.flash = ''
  form.colorSpace = ''
  form.resolutionX = ''
  form.resolutionY = ''
  form.resolutionUnit = ''
  form.software = ''
  form.captureTime = ''
  captureTimeLocal.value = ''
  form.notes = ''
}

function setUploadValue(file: File | null): void {
  uploadValue.value = file
}

function setUploadMode(mode: UploadMode): void {
  if (uploadMode.value === mode) {
    return
  }
  if (hasSelection.value) {
    clearSelectedFile()
  }
  uploadMode.value = mode
}

function clearFormForNewFile(): void {
  resetFileState()
  resetOptionalFields()
  resetUploadMetrics()
}

function clearSelectedFile(): void {
  clearFormForNewFile()
  setUploadValue(null)
  clearVideoSelection()
}

function resetFileState(): void {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
  }
  previewUrl.value = ''
  form.width = 0
  form.height = 0
  const inputEl = getFileInputElement('image')
  if (inputEl) {
    inputEl.value = ''
  }
}

function clearVideoSelection(): void {
  if (videoPreviewUrl.value) {
    URL.revokeObjectURL(videoPreviewUrl.value)
  }
  videoPreviewUrl.value = ''
  liveFrameDuration.value = 0
  liveFrameTime.value = 0
  liveFramePending.value = false
  videoValue.value = null
  const inputEl = getFileInputElement('video')
  if (inputEl) {
    inputEl.value = ''
  }
}

function resetUploadMetrics(): void {
  uploadProgress.value = 0
  uploadSpeed.value = 0
  uploadBytesSent.value = 0
  uploadTotalBytes.value = 0
  uploadStartedAt.value = null
}

function getFileInputElement(target: 'image' | 'video'): HTMLInputElement | null {
  const refTarget = target === 'image' ? fileUploadRef.value : videoUploadRef.value
  const exposed = refTarget?.inputRef
  if (!exposed) {
    return null
  }
  if (exposed instanceof HTMLInputElement) {
    return exposed
  }
  const element = (exposed as { value?: unknown }).value
  return element instanceof HTMLInputElement ? element : null
}

async function detectImageSize(file: File, token: number): Promise<void> {
  if (typeof globalThis.Image !== 'function') {
    return
  }

  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
  }
  const objectUrl = URL.createObjectURL(file)
  previewUrl.value = objectUrl

  try {
    const size = await new Promise<{ width: number, height: number }>((resolve, reject) => {
      const img = new Image()
      img.addEventListener('load', () => resolve({ width: img.naturalWidth, height: img.naturalHeight }))
      img.addEventListener('error', () => reject(new Error(t('admin.upload.toast.sizeReadError'))))
      img.src = objectUrl
    })

    if (token !== activeMetadataToken) {
      URL.revokeObjectURL(objectUrl)
      return
    }

    form.width = size.width
    form.height = size.height
  }
  catch (error) {
    if (token !== activeMetadataToken) {
      URL.revokeObjectURL(objectUrl)
      return
    }
    const message = error instanceof Error ? error.message : toastMessages.value.sizeFailedFallback
    toast.add({ title: toastMessages.value.sizeFailed, description: message, color: 'error' })
    URL.revokeObjectURL(objectUrl)
    previewUrl.value = ''
  }
}

interface ExifData {
  Make?: string
  Model?: string
  ImageDescription?: string
  XPComment?: string | string[]
  XPKeywords?: string[]
  FNumber?: number
  ExposureTime?: number
  ShutterSpeedValue?: number
  FocalLength?: number
  ISO?: number
  LensModel?: string
  DateTimeOriginal?: string | Date
  CreateDate?: string | Date
  latitude?: number
  longitude?: number
  ExposureBiasValue?: number | string
  ExposureCompensation?: number | string
  ExposureProgram?: number | string
  ExposureMode?: number | string
  MeteringMode?: number | string
  WhiteBalance?: number | string
  Flash?: number | string
  ColorSpace?: number | string
  XResolution?: number | string
  YResolution?: number | string
  ResolutionUnit?: number | string
  Software?: string | string[]
}

function formatLocation(latitude: number | undefined, longitude: number | undefined): string {
  if (latitude === undefined || longitude === undefined) {
    return ''
  }
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
}

function textFrom(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value.join(' ')
  }
  return value ?? ''
}

function formatAperture(value: number | undefined): string {
  if (!value || value <= 0) {
    return ''
  }
  return `f/${value.toFixed(1)}`
}

function formatShutter(exposureTime?: number, shutterSpeed?: number): string {
  if (exposureTime && exposureTime > 0) {
    if (exposureTime < 1) {
      return `1/${Math.round(1 / exposureTime)}s`
    }
    return `${exposureTime.toFixed(2)}s`
  }
  if (shutterSpeed !== undefined) {
    const base = 2 ** -shutterSpeed
    if (base < 1) {
      return `1/${Math.round(1 / base)}s`
    }
    return `${base.toFixed(2)}s`
  }
  return ''
}

function formatFocal(value: number | undefined): string {
  if (!value || value <= 0) {
    return ''
  }
  return `${value.toFixed(0)}mm`
}

function formatExposureBias(value: number | string | undefined): string {
  if (value === undefined || value === null) {
    return ''
  }
  const numeric = typeof value === 'string' ? Number(value) : value
  if (Number.isFinite(numeric)) {
    const rounded = Math.round(numeric * 10) / 10
    const sign = rounded > 0 ? '+' : ''
    return `${sign}${rounded.toFixed(1)} EV`
  }
  const text = String(value).trim()
  return text.length > 0 ? text : ''
}

function formatExposureProgram(value: number | string | undefined): string {
  if (value === undefined || value === null) {
    return ''
  }
  const map: Record<number, string> = {
    0: 'Not defined',
    1: 'Manual',
    2: 'Program',
    3: 'Aperture priority',
    4: 'Shutter priority',
    5: 'Creative',
    6: 'Action',
    7: 'Portrait',
    8: 'Landscape',
  }
  const numeric = typeof value === 'string' ? Number(value) : value
  const text = Number.isFinite(numeric) ? map[numeric] ?? `Program ${numeric}` : String(value).trim()
  return normalizeToOption(text, exposureProgramOptions.value, {
    'normal program': 'Program',
    'program normal': 'Program',
  })
}

function formatExposureMode(value: number | string | undefined): string {
  if (value === undefined || value === null) {
    return ''
  }
  const map: Record<number, string> = {
    0: 'Auto',
    1: 'Manual',
    2: 'Auto bracket',
  }
  const numeric = typeof value === 'string' ? Number(value) : value
  const text = Number.isFinite(numeric) ? map[numeric] ?? `Mode ${numeric}` : String(value).trim()
  return normalizeToOption(text, exposureModeOptions.value)
}

function formatMeteringMode(value: number | string | undefined): string {
  if (value === undefined || value === null) {
    return ''
  }
  const map: Record<number, string> = {
    0: 'Unknown',
    1: 'Average',
    2: 'Center-weighted',
    3: 'Spot',
    4: 'Multi-spot',
    5: 'Pattern',
    6: 'Partial',
    255: 'Other',
  }
  const numeric = typeof value === 'string' ? Number(value) : value
  const text = Number.isFinite(numeric) ? map[numeric] ?? `Mode ${numeric}` : String(value).trim()
  return normalizeToOption(text, meteringModeOptions.value, {
    'matrix': 'Pattern',
    'multispot': 'Multi-spot',
    'multi-spot': 'Multi-spot',
    'center-weighted average': 'Center-weighted',
  })
}

function formatWhiteBalance(value: number | string | undefined): string {
  if (value === undefined || value === null) {
    return ''
  }
  const map: Record<number, string> = {
    0: 'Auto',
    1: 'Manual',
  }
  const numeric = typeof value === 'string' ? Number(value) : value
  const text = Number.isFinite(numeric) ? map[numeric] ?? `WB ${numeric}` : String(value).trim()
  return normalizeToOption(text, whiteBalanceOptions.value)
}

function formatFlash(value: number | string | undefined): string {
  if (value === undefined || value === null) {
    return ''
  }
  const numeric = typeof value === 'string' ? Number(value) : value
  if (Number.isFinite(numeric)) {
    const fired = (numeric & 1) === 1
    const auto = (numeric & 24) === 24
    if (fired) {
      return auto ? 'Auto (fired)' : 'Fired'
    }
    return auto ? 'Auto (did not fire)' : 'Did not fire'
  }
  const text = String(value).trim()
  return normalizeToOption(text, flashOptions.value, {
    'did not fire': 'Did not fire',
    'auto, did not fire': 'Auto (did not fire)',
    'auto - did not fire': 'Auto (did not fire)',
    'auto, fired': 'Auto (fired)',
  })
}

function formatResolutionValue(value: number | string | undefined): string {
  if (value === undefined || value === null) {
    return ''
  }
  const numeric = typeof value === 'string' ? Number(value) : value
  if (Number.isFinite(numeric)) {
    if (Number.isInteger(numeric)) {
      return numeric.toString()
    }
    return numeric.toFixed(2).replace(/\.0+$/, '').replace(/0+$/, '').replace(/\.$/, '')
  }
  return String(value)
}

function formatResolutionUnit(value: number | string | undefined): string {
  if (value === undefined || value === null) {
    return ''
  }
  const numeric = typeof value === 'string' ? Number(value) : value
  if (Number.isFinite(numeric)) {
    if (numeric === 2) {
      return 'Pixels/Inch'
    }
    if (numeric === 3) {
      return 'Pixels/Centimeter'
    }
  }
  return String(value)
}

function formatColorSpace(value: number | string | undefined): string {
  if (value === undefined || value === null) {
    return ''
  }
  const numeric = typeof value === 'string' ? Number(value) : value
  if (Number.isFinite(numeric)) {
    if (numeric === 1) {
      return 'sRGB'
    }
    if (numeric === 65_535) {
      return 'Uncalibrated'
    }
  }
  const text = String(value).trim()
  if (text.length === 0) {
    return ''
  }
  return text
}

function formatDate(value: string | Date | undefined): string {
  if (!value) {
    return ''
  }
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return date.toISOString()
}

async function extractExif(file: File, token: number): Promise<void> {
  try {
    const parsed = (await exifr.parse(file, [
      'Make',
      'Model',
      'ImageDescription',
      'XPComment',
      'XPKeywords',
      'FNumber',
      'ExposureTime',
      'ShutterSpeedValue',
      'FocalLength',
      'ISO',
      'LensModel',
      'DateTimeOriginal',
      'CreateDate',
      'latitude',
      'longitude',
      'ExposureBiasValue',
      'ExposureCompensation',
      'ExposureProgram',
      'ExposureMode',
      'MeteringMode',
      'WhiteBalance',
      'Flash',
      'ColorSpace',
      'XResolution',
      'YResolution',
      'ResolutionUnit',
      'Software',
    ])) as ExifData | undefined

    if (!parsed || token !== activeMetadataToken) {
      return
    }

    const model = [parsed.Make, parsed.Model].filter(Boolean).join(' ').trim()
    const lens = parsed.LensModel ?? ''
    const locationText = formatLocation(parsed.latitude, parsed.longitude)
    const description = textFrom(parsed.ImageDescription ?? parsed.XPComment ?? textFrom(parsed.XPKeywords))
    const aperture = formatAperture(parsed.FNumber)
    const shutter = formatShutter(parsed.ExposureTime, parsed.ShutterSpeedValue)
    const focal = formatFocal(parsed.FocalLength)
    const iso = parsed.ISO ? String(parsed.ISO) : ''
    const exposureBias = formatExposureBias(parsed.ExposureBiasValue ?? parsed.ExposureCompensation)
    const exposureProgram = formatExposureProgram(parsed.ExposureProgram)
    const exposureMode = formatExposureMode(parsed.ExposureMode)
    const meteringMode = formatMeteringMode(parsed.MeteringMode)
    const whiteBalance = formatWhiteBalance(parsed.WhiteBalance)
    const flash = formatFlash(parsed.Flash)
    const colorSpace = formatColorSpace(parsed.ColorSpace)
    const resolutionX = formatResolutionValue(parsed.XResolution)
    const resolutionY = formatResolutionValue(parsed.YResolution)
    const resolutionUnit = formatResolutionUnit(parsed.ResolutionUnit)
    const software = textFrom(parsed.Software)
    const captureTime = formatDate(parsed.DateTimeOriginal ?? parsed.CreateDate)

    if (token !== activeMetadataToken) {
      return
    }

    if (model) {
      form.cameraModel = model
    }
    if (lens) {
      form.lensModel = lens
    }
    if (locationText) {
      form.location = locationText
      form.locationName = locationText
    }
    if (description && !form.description) {
      form.description = description
    }
    if (aperture) {
      form.aperture = aperture
    }
    if (shutter) {
      form.shutterSpeed = shutter
    }
    if (focal) {
      form.focalLength = focal
    }
    if (iso) {
      form.iso = iso
    }
    if (exposureBias) {
      form.exposureBias = exposureBias
    }
    if (exposureProgram) {
      form.exposureProgram = exposureProgram
    }
    if (exposureMode) {
      form.exposureMode = exposureMode
    }
    if (meteringMode) {
      form.meteringMode = meteringMode
    }
    if (whiteBalance) {
      form.whiteBalance = whiteBalance
    }
    if (flash) {
      form.flash = flash
    }
    if (colorSpace) {
      form.colorSpace = colorSpace
    }
    if (resolutionX) {
      form.resolutionX = resolutionX
    }
    if (resolutionY) {
      form.resolutionY = resolutionY
    }
    if (resolutionUnit) {
      form.resolutionUnit = resolutionUnit
    }
    if (software) {
      form.software = software
    }
    if (captureTime) {
      form.captureTime = captureTime
      captureTimeLocal.value = toLocalInputString(captureTime)
    }
  }
  catch (error) {
    const message = error instanceof Error ? error.message : toastMessages.value.exifFailedFallback
    toast.add({ title: toastMessages.value.exifFailed, description: message, color: 'warning' })
  }
}

async function refreshMetadata(file: File, token: number): Promise<void> {
  await detectImageSize(file, token)
  await extractExif(file, token)
}

async function handleSelectedFileChange(file: File | null): Promise<void> {
  activeMetadataToken += 1
  const token = activeMetadataToken
  clearFormForNewFile()
  if (!file) {
    return
  }
  await refreshMetadata(file, token)
}

watch(selectedFile, (file, previous) => {
  if (file === previous) {
    return
  }
  void handleSelectedFileChange(file)
})

watch(videoValue, (file, previous) => {
  if (file === previous) {
    return
  }
  void handleVideoSelected(file)
})

function openFileDialog(): void {
  const target = isLiveMode.value ? 'video' : 'image'
  getFileInputElement(target)?.click()
}

async function handleVideoSelected(file: File | null): Promise<void> {
  liveFramePending.value = false
  if (!file) {
    setUploadValue(null)
    liveFrameDuration.value = 0
    liveFrameTime.value = 0
    if (videoPreviewUrl.value) {
      URL.revokeObjectURL(videoPreviewUrl.value)
    }
    videoPreviewUrl.value = ''
    return
  }
  clearFormForNewFile()
  setUploadValue(null)
  if (videoPreviewUrl.value) {
    URL.revokeObjectURL(videoPreviewUrl.value)
  }
  videoPreviewUrl.value = URL.createObjectURL(file)
  liveFrameDuration.value = 0
  liveFrameTime.value = 0
}

function handleVideoMetadataLoaded(): void {
  const video = videoElementRef.value
  if (!video) {
    return
  }
  const duration = Number.isFinite(video.duration) ? video.duration : 0
  liveFrameDuration.value = Math.max(0, duration)
  const fallbackTime = Math.max(0, duration - 0.1)
  liveFrameTime.value = normalizeFrameTime(fallbackTime)
  void captureLiveFrame()
}

function handleVideoError(): void {
  toast.add({ title: toastMessages.value.videoFailed, color: 'error' })
}

function handleFrameInput(event: Event): void {
  if (!(event.target instanceof HTMLInputElement)) {
    return
  }
  const value = Number(event.target.value)
  if (!Number.isFinite(value)) {
    return
  }
  const normalized = normalizeFrameTime(value)
  liveFrameTime.value = normalized
  const video = videoElementRef.value
  if (video) {
    video.currentTime = normalized
  }
  void captureLiveFrame()
}

async function captureLiveFrame(): Promise<void> {
  const video = videoElementRef.value
  if (!video || !selectedVideo.value || liveFrameDuration.value <= 0) {
    return
  }
  if (liveFramePending.value) {
    return
  }
  liveFramePending.value = true
  try {
    const targetTime = normalizeFrameTime(liveFrameTime.value)
    await seekVideo(video, targetTime)
    const width = video.videoWidth
    const height = video.videoHeight
    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
      throw new Error('Invalid video frame size.')
    }
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Canvas context not available.')
    }
    context.drawImage(video, 0, 0, width, height)
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92))
    if (!blob) {
      throw new Error('Frame capture failed.')
    }
    const baseName = selectedVideo.value.name.replace(/\.[^/.]+$/, '') || 'live-photo'
    const frameFile = new File([blob], `${baseName}-frame.jpg`, { type: blob.type || 'image/jpeg' })
    setUploadValue(frameFile)
  }
  catch (error) {
    const message = error instanceof Error ? error.message : toastMessages.value.frameFailed
    toast.add({ title: toastMessages.value.frameFailed, description: message, color: 'error' })
  }
  finally {
    liveFramePending.value = false
  }
}

async function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  if (!Number.isFinite(time)) {
    return
  }
  if (Math.abs(video.currentTime - time) < 0.02) {
    return
  }
  await new Promise<void>((resolve, reject) => {
    let handleSeeked: (() => void) | null = null
    let handleError: (() => void) | null = null
    const cleanup = (): void => {
      if (handleSeeked) {
        video.removeEventListener('seeked', handleSeeked)
      }
      if (handleError) {
        video.removeEventListener('error', handleError)
      }
    }
    handleSeeked = (): void => {
      cleanup()
      resolve()
    }
    handleError = (): void => {
      cleanup()
      reject(new Error('Seek failed.'))
    }
    video.addEventListener('seeked', handleSeeked, { once: true })
    video.addEventListener('error', handleError, { once: true })
    video.currentTime = time
  })
}

function normalizeFrameTime(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  const duration = liveFrameDuration.value
  if (!Number.isFinite(duration) || duration <= 0) {
    return Math.max(0, value)
  }
  const maxTime = Math.max(0, duration - 0.05)
  return Math.min(Math.max(0, value), maxTime)
}

function extractClipboardImage(event: ClipboardEvent): File | null {
  const data = event.clipboardData
  if (!data) {
    return null
  }
  const fileFromFiles = [...data.files].find(file => file.type.startsWith('image/'))
  if (fileFromFiles) {
    return fileFromFiles
  }
  const fileFromItems = [...data.items]
    .find(item => item.kind === 'file' && item.type.startsWith('image/'))
    ?.getAsFile()
  return fileFromItems ?? null
}

async function handlePaste(event: ClipboardEvent): Promise<void> {
  const file = extractClipboardImage(event)
  if (!file) {
    return
  }
  event.preventDefault()
  setUploadMode('image')
  setUploadValue(file)
}

onMounted(() => {
  const target = typeof globalThis.addEventListener === 'function' ? (globalThis as unknown as Window) : null
  if (!target) {
    return
  }
  pasteListener = (event: ClipboardEvent) => {
    void handlePaste(event)
  }
  target.addEventListener('paste', pasteListener)
})

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }
  const kb = bytes / 1024
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`
  }
  const mb = kb / 1024
  return `${mb.toFixed(1)} MB`
}

function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond <= 0) {
    return '0 B/s'
  }
  const kb = bytesPerSecond / 1024
  if (kb < 1) {
    return `${bytesPerSecond.toFixed(0)} B/s`
  }
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB/s`
  }
  const mb = kb / 1024
  return `${mb.toFixed(1)} MB/s`
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0:00'
  }
  const total = Math.floor(seconds)
  const minutes = Math.floor(total / 60)
  const remainder = total % 60
  return `${minutes}:${remainder.toString().padStart(2, '0')}`
}

const previewChips = computed(() => {
  const chips: { icon: string, text: string }[] = []
  if (form.width > 0 && form.height > 0) {
    chips.push({ icon: 'tabler:aspect-ratio', text: `${form.width} × ${form.height}` })
  }
  if (captureTimeDisplay.value) {
    chips.push({ icon: 'tabler:calendar-time', text: captureTimeDisplay.value })
  }
  if (selectedFile.value) {
    chips.push({ icon: 'tabler:file-type-jpg', text: formatFileSize(selectedFile.value.size) })
  }
  if (selectedVideo.value) {
    chips.push({ icon: 'tabler:movie', text: formatFileSize(selectedVideo.value.size) })
  }
  return chips
})

function stopProcessingStatusPoll(): void {
  if (processingPollTimer.value !== null) {
    clearInterval(processingPollTimer.value)
    processingPollTimer.value = null
  }
}

function pushProcessingToast(status: UploadProcessingStatus | 'unknown'): void {
  if (!processingToastId.value) {
    return
  }
  if (status === 'processing') {
    toast.add({
      id: processingToastId.value,
      title: toastMessages.value.processing,
      description: toastMessages.value.processingDescription,
      color: 'primary',
      duration: Number.POSITIVE_INFINITY,
    })
    return
  }
  if (status === 'completed') {
    toast.add({
      id: processingToastId.value,
      title: toastMessages.value.processingDoneTitle,
      description: toastMessages.value.processingDoneDescription,
      color: 'success',
    })
    return
  }
  toast.add({
    id: processingToastId.value,
    title: toastMessages.value.processingFailedTitle,
    description: toastMessages.value.processingFailedDescription,
    color: 'error',
  })
}

function startProcessingStatusPoll(uploadId: string): void {
  stopProcessingStatusPoll()
  processingToastId.value = `upload-processing-${uploadId}`
  pushProcessingToast('processing')
  let attempts = 0
  const maxAttempts = 120
  const poll = async (): Promise<void> => {
    attempts += 1
    try {
      const response = await requestFetch<{ status: UploadProcessingStatus | 'unknown' }>('/api/files/status', {
        params: { uploadId },
        retry: 0,
      })
      if (response.status === 'processing') {
        if (attempts >= maxAttempts) {
          pushProcessingToast('failed')
          stopProcessingStatusPoll()
        }
        return
      }
      pushProcessingToast(response.status)
      stopProcessingStatusPoll()
    }
    catch {
      if (attempts >= maxAttempts) {
        pushProcessingToast('failed')
        stopProcessingStatusPoll()
      }
    }
  }
  void poll()
  processingPollTimer.value = setInterval(() => {
    void poll()
  }, 2000)
}

function extractUploadIdFromResponse(response: unknown): string | undefined {
  if (typeof response === 'object' && response !== null && 'uploadId' in response) {
    const value = (response as Record<string, unknown>).uploadId
    return typeof value === 'string' ? value : undefined
  }
  if (typeof response === 'string') {
    try {
      const parsed = JSON.parse(response) as Record<string, unknown>
      const uploadId = parsed.uploadId
      return typeof uploadId === 'string' ? uploadId : undefined
    }
    catch {
      return undefined
    }
  }
  return undefined
}

function sendFileWithProgress(formData: FormData): Promise<{ uploadId?: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.responseType = 'json'
    uploadStartedAt.value = performance.now()
    uploadBytesSent.value = 0
    uploadTotalBytes.value = totalUploadBytes.value
    xhr.upload.addEventListener('progress', (event) => {
      const total = event.lengthComputable ? event.total : uploadTotalBytes.value
      if (event.lengthComputable) {
        uploadTotalBytes.value = event.total
      }
      const loaded = event.loaded
      uploadBytesSent.value = loaded
      uploadProgress.value = total > 0 ? Math.min(100, (loaded / total) * 100) : 0
      const startedAt = uploadStartedAt.value
      if (startedAt !== null) {
        const elapsedSeconds = (performance.now() - startedAt) / 1000
        if (elapsedSeconds > 0) {
          uploadSpeed.value = loaded / elapsedSeconds
        }
      }
    })
    // eslint-disable-next-line unicorn/prefer-add-event-listener
    xhr.onerror = () => reject(new Error('Upload failed'))
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        uploadBytesSent.value = uploadTotalBytes.value || uploadBytesSent.value
        uploadProgress.value = 100
        const uploadId = extractUploadIdFromResponse(xhr.response ?? xhr.responseText)
        resolve({ uploadId })
      }
      else {
        reject(new Error(xhr.statusText || 'Upload failed'))
      }
    })
    xhr.open('POST', '/api/files')
    xhr.send(formData)
  })
}

async function submit(): Promise<void> {
  if (isLiveMode.value && !selectedVideo.value) {
    toast.add({ title: toastMessages.value.selectVideo, color: 'warning' })
    return
  }

  if (!selectedFile.value) {
    const message = isLiveMode.value ? toastMessages.value.selectFrame : toastMessages.value.selectImage
    toast.add({ title: message, color: 'warning' })
    return
  }

  if (form.width <= 0 || form.height <= 0) {
    toast.add({ title: toastMessages.value.readSize, color: 'warning' })
    return
  }

  submitting.value = true
  resetUploadMetrics()
  stopProcessingStatusPoll()
  try {
    const formData = new FormData()
    formData.append('file', selectedFile.value)
    if (selectedVideo.value) {
      formData.append('video', selectedVideo.value)
    }
    formData.append('width', String(form.width))
    formData.append('height', String(form.height))
    formData.append('title', form.title)
    formData.append('description', form.description)
    formData.append('genre', form.genre)
    formData.append('location', form.location)
    formData.append('locationName', form.locationName)
    formData.append('latitude', form.latitude === null ? '' : String(form.latitude))
    formData.append('longitude', form.longitude === null ? '' : String(form.longitude))
    formData.append('cameraModel', form.cameraModel)
    formData.append('lensModel', form.lensModel)
    formData.append('aperture', form.aperture)
    formData.append('focalLength', form.focalLength)
    formData.append('iso', form.iso)
    formData.append('shutterSpeed', form.shutterSpeed)
    formData.append('exposureBias', form.exposureBias)
    formData.append('exposureProgram', form.exposureProgram)
    formData.append('exposureMode', form.exposureMode)
    formData.append('meteringMode', form.meteringMode)
    formData.append('whiteBalance', form.whiteBalance)
    formData.append('flash', form.flash)
    formData.append('colorSpace', form.colorSpace)
    formData.append('resolutionX', form.resolutionX)
    formData.append('resolutionY', form.resolutionY)
    formData.append('resolutionUnit', form.resolutionUnit)
    formData.append('software', form.software)
    formData.append('captureTime', form.captureTime)
    formData.append('notes', form.notes)
    formData.append('livePhotoStillTime', isLiveMode.value ? String(liveFrameTime.value) : '')

    const { uploadId } = await sendFileWithProgress(formData)
    clearSelectedFile()
    if (uploadId) {
      startProcessingStatusPoll(uploadId)
    }
    else {
      toast.add({
        title: toastMessages.value.processingDoneTitle,
        description: toastMessages.value.processingDoneDescription,
        color: 'success',
      })
    }
  }
  catch (error) {
    const message = error instanceof Error ? error.message : toastMessages.value.saveFailedFallback
    toast.add({ title: toastMessages.value.saveFailedTitle, description: message, color: 'error' })
  }
  finally {
    submitting.value = false
  }
}

onBeforeUnmount(() => {
  const target = typeof globalThis.removeEventListener === 'function' ? (globalThis as unknown as Window) : null
  if (pasteListener && target) {
    target.removeEventListener('paste', pasteListener)
  }
  stopProcessingStatusPoll()
  clearSelectedFile()
})
</script>

<template>
  <div class="min-h-screen">
    <UContainer class="space-y-8 py-10">
      <AdminNav />

      <header class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="flex items-center gap-2 text-3xl font-semibold">
            <Icon name="tabler:database" class="h-6 w-6 text-primary" />
            <span>{{ t('admin.upload.title') }}</span>
          </h1>
        </div>
      </header>

      <div v-show="!hasSelection" class="grid gap-6">
        <UCard>
          <template #header>
            <div class="space-y-1">
              <h2 class="flex items-center gap-2 text-xl font-semibold">
                <Icon name="tabler:upload" class="h-5 w-5 text-primary" />
                <span>{{ t('admin.upload.sections.upload.label') }}</span>
              </h2>
            </div>
          </template>
          <div class="space-y-4">
            <div class="flex flex-wrap items-center gap-2">
              <UButton
                size="sm"
                type="button"
                :variant="uploadMode === 'image' ? 'solid' : 'soft'"
                :color="uploadMode === 'image' ? 'primary' : 'neutral'"
                :aria-pressed="uploadMode === 'image'"
                @click="setUploadMode('image')"
              >
                {{ t('admin.upload.sections.upload.mode.image') }}
              </UButton>
              <UButton
                size="sm"
                type="button"
                :variant="uploadMode === 'live' ? 'solid' : 'soft'"
                :color="uploadMode === 'live' ? 'primary' : 'neutral'"
                :aria-pressed="uploadMode === 'live'"
                @click="setUploadMode('live')"
              >
                {{ t('admin.upload.sections.upload.mode.live') }}
              </UButton>
            </div>
            <p v-if="uploadMode === 'live'" class="text-xs text-muted">
              {{ t('admin.upload.sections.upload.liveHint') }}
            </p>
            <UFileUpload
              v-if="uploadMode === 'image'"
              ref="fileUploadRef"
              v-model="uploadValue"
              accept="image/*"
              :label="t('admin.upload.sections.upload.dropHint')"
              :description="t('admin.upload.sections.upload.supported')"
              class="w-full"
            />
            <UFileUpload
              v-else
              ref="videoUploadRef"
              v-model="videoValue"
              accept="video/*"
              :label="t('admin.upload.sections.upload.liveDropHint')"
              :description="t('admin.upload.sections.upload.liveSupported')"
              class="w-full"
            />
          </div>
        </UCard>
      </div>

      <UForm
        v-if="hasSelection"
        :state="form"
        class="space-y-4"
        @submit.prevent="submit"
      >
        <div class="space-y-3 rounded-2xl border border-default/50 bg-default/60 p-4 shadow-sm">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div class="flex items-center gap-3">
              <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/10">
                <Icon name="tabler:database-edit" class="h-5 w-5" />
              </div>
              <div class="space-y-0.5">
                <p class="text-xs font-semibold uppercase tracking-wide text-muted">
                  {{ t('admin.upload.sections.edit.title') }}
                </p>
                <p class="text-base font-semibold text-highlighted">
                  {{ displayFileName }}
                </p>
              </div>
            </div>
            <div class="hidden shrink-0 items-center gap-2 sm:flex">
              <UButton
                variant="soft"
                color="neutral"
                type="button"
                icon="tabler:x"
                @click="clearSelectedFile"
              >
                {{ t('common.actions.cancel') }}
              </UButton>
              <UButton
                color="primary"
                type="submit"
                :loading="submitting"
                :disabled="!selectedFile"
                icon="tabler:device-floppy"
              >
                {{ t('admin.upload.actions.save') }}
              </UButton>
            </div>
          </div>
          <div v-if="previewChips.length > 0" class="flex flex-wrap gap-2">
            <span
              v-for="chip in previewChips"
              :key="`${chip.icon}-${chip.text}`"
              class="inline-flex items-center gap-2 rounded-full bg-elevated/80 px-3 py-1 text-xs font-medium text-highlighted ring-1 ring-default/50"
            >
              <Icon :name="chip.icon" class="h-4 w-4 text-primary" />
              <span>{{ chip.text }}</span>
            </span>
          </div>
          <div class="flex flex-col gap-2 sm:hidden">
            <UButton
              variant="soft"
              color="neutral"
              type="button"
              icon="tabler:x"
              @click="clearSelectedFile"
            >
              {{ t('common.actions.cancel') }}
            </UButton>
            <UButton
              color="primary"
              type="submit"
              :loading="submitting"
              :disabled="!selectedFile"
              icon="tabler:device-floppy"
            >
              {{ t('admin.upload.actions.save') }}
            </UButton>
          </div>
        </div>

        <div class="grid gap-6 xl:grid-cols-[minmax(360px,520px),1fr]">
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
                  @click="openFileDialog()"
                >
                  {{ changePrimaryLabel }}
                </UButton>
              </div>
            </template>
            <div class="space-y-4">
              <div class="space-y-3">
                <div
                  class="flex w-full cursor-pointer items-center justify-center rounded-xl border border-default/50 bg-black/10 outline-none ring-primary/40 focus-visible:ring-2"
                  :style="{ aspectRatio: aspectRatioStyle, maxHeight: `${previewMaxHeight}px` }"
                  role="button"
                  tabindex="0"
                  :aria-label="changePrimaryLabel"
                  @click="openFileDialog()"
                  @keydown.enter.prevent="openFileDialog()"
                  @keydown.space.prevent="openFileDialog()"
                >
                  <img
                    v-if="previewUrl"
                    :src="previewUrl"
                    :alt="t('admin.upload.sections.preview.alt')"
                    class="max-h-full max-w-full object-contain"
                    :style="{ maxHeight: `${previewMaxHeight}px` }"
                  >
                  <div
                    v-else-if="isLiveMode && selectedVideo"
                    class="px-6 text-center text-xs text-muted"
                  >
                    {{ t('admin.upload.sections.livePhoto.framePlaceholder') }}
                  </div>
                </div>
              </div>
              <div
                v-if="selectedFile"
                class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-default/50 bg-default/80 px-3 py-2 text-sm"
              >
                <div class="flex items-center gap-2">
                  <Icon name="tabler:photo" class="h-4 w-4 text-primary" />
                  <span class="font-semibold text-highlighted">
                    {{ selectedFileName }}
                  </span>
                </div>
                <div class="flex items-center gap-2 text-xs text-muted">
                  <Icon name="tabler:info-circle" class="h-4 w-4" />
                  <span>{{ selectedFile?.type || 'image' }}</span>
                </div>
              </div>
              <div
                v-if="selectedVideo"
                class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-default/50 bg-default/80 px-3 py-2 text-sm"
              >
                <div class="flex items-center gap-2">
                  <Icon name="tabler:movie" class="h-4 w-4 text-primary" />
                  <span class="font-semibold text-highlighted">
                    {{ selectedVideoName }}
                  </span>
                </div>
                <div class="flex items-center gap-2 text-xs text-muted">
                  <Icon name="tabler:info-circle" class="h-4 w-4" />
                  <span>{{ selectedVideo?.type || 'video' }}</span>
                </div>
              </div>
              <div
                v-if="selectedVideo"
                class="space-y-3 rounded-lg border border-default/50 bg-default/80 px-3 py-3"
              >
                <div class="flex items-center justify-between gap-2 text-xs text-muted">
                  <div class="flex items-center gap-2">
                    <Icon name="tabler:movie" class="h-4 w-4 text-primary" />
                    <span class="font-semibold text-highlighted">
                      {{ t('admin.upload.sections.livePhoto.title') }}
                    </span>
                  </div>
                  <span>{{ liveFrameDurationLabel }}</span>
                </div>
                <video
                  ref="videoElementRef"
                  :src="videoPreviewUrl"
                  :poster="previewUrl || undefined"
                  class="w-full max-h-64 rounded-lg border border-default/50 bg-black/10 object-contain"
                  muted
                  playsinline
                  preload="metadata"
                  @loadedmetadata="handleVideoMetadataLoaded"
                  @error="handleVideoError"
                />
                <div class="flex items-center gap-2 text-xs text-muted">
                  <span class="tabular-nums text-highlighted">{{ liveFrameTimeLabel }}</span>
                  <input
                    type="range"
                    min="0"
                    :max="liveFrameDuration"
                    step="0.1"
                    :value="liveFrameTime"
                    class="h-1 w-full cursor-pointer accent-primary"
                    :disabled="liveFrameDuration <= 0"
                    @input="handleFrameInput"
                  >
                  <span class="tabular-nums">{{ liveFrameDurationLabel }}</span>
                </div>
                <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                  <span>{{ t('admin.upload.sections.livePhoto.frameHint') }}</span>
                  <UButton
                    size="sm"
                    type="button"
                    color="primary"
                    variant="soft"
                    :loading="liveFramePending"
                    :disabled="liveFrameDuration <= 0"
                    @click="captureLiveFrame"
                  >
                    {{ t('admin.upload.sections.livePhoto.useFrame') }}
                  </UButton>
                </div>
              </div>
              <div
                v-if="isUploading"
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
                    {{ uploadProgressPercent.toFixed(1) }}%
                  </span>
                </div>
                <div class="h-2 w-full overflow-hidden rounded-full bg-default/50">
                  <div
                    class="h-full bg-primary transition-all"
                    :style="{ width: `${uploadProgressPercent}%` }"
                  />
                </div>
                <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                  <span class="flex items-center gap-1">
                    <Icon name="tabler:database-export" class="h-4 w-4" />
                    <span>{{ t('admin.upload.sections.progress.uploaded') }}:</span>
                    <span class="text-highlighted">{{ uploadedBytesText }}</span>
                    <span v-if="uploadTotalBytes">/ {{ uploadTotalText }}</span>
                  </span>
                  <span class="flex items-center gap-1">
                    <Icon name="tabler:gauge" class="h-4 w-4" />
                    <span>{{ t('admin.upload.sections.progress.speed') }}:</span>
                    <span class="text-highlighted">{{ uploadSpeedText }}</span>
                  </span>
                </div>
                <p class="text-[11px] text-muted">
                  {{ t('admin.upload.sections.progress.total') }}: {{ uploadTotalText }}
                </p>
              </div>
            </div>
          </UCard>

          <UCard class="border border-default/50 bg-default/70">
            <template #header>
              <div class="space-y-1">
                <h2 class="flex items-center gap-2 text-xl font-semibold">
                  <Icon name="tabler:database-edit" class="h-5 w-5 text-primary" />
                  <span>{{ t('admin.upload.sections.edit.title') }}</span>
                </h2>
              </div>
            </template>
            <div class="space-y-6">
              <AdminMetadataForm
                v-model:form="formModel"
                v-model:capture-time-local="captureTimeLocal"
                :classify-source="{ file: selectedFile }"
              />

              <div class="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <UButton
                  variant="soft"
                  color="neutral"
                  type="button"
                  class="w-full sm:w-auto"
                  icon="tabler:x"
                  @click="clearSelectedFile"
                >
                  {{ t('common.actions.cancel') }}
                </UButton>
                <UButton
                  color="primary"
                  type="submit"
                  :loading="submitting"
                  :disabled="!selectedFile"
                  class="w-full sm:w-auto"
                  icon="tabler:device-floppy"
                >
                  {{ t('admin.upload.actions.save') }}
                </UButton>
              </div>
            </div>
          </UCard>
        </div>
      </UForm>
    </UContainer>
  </div>
</template>
