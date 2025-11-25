<script setup lang="ts">
import exifr from 'exifr'
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'

const { t } = useI18n()
const toast = useToast()
definePageMeta({
  middleware: 'admin-auth',
})

const pageTitle = computed(() => t('admin.upload.seoTitle'))
const pageDescription = computed(() => t('admin.upload.seoDescription'))

const toastMessages = computed(() => ({
  selectImage: t('admin.upload.toast.selectImage'),
  readSize: t('admin.upload.toast.readSize'),
  sizeFailed: t('admin.upload.toast.sizeFailed'),
  sizeFailedFallback: t('admin.upload.toast.sizeFailedFallback'),
  exifFailed: t('admin.upload.toast.exifFailed'),
  exifFailedFallback: t('admin.upload.toast.exifFailedFallback'),
  saveSuccessTitle: t('admin.upload.toast.saveSuccessTitle'),
  saveSuccessDescription: t('admin.upload.toast.saveSuccessDescription'),
  saveFailedTitle: t('admin.upload.toast.saveFailedTitle'),
  saveFailedFallback: t('admin.upload.toast.saveFailedFallback'),
}))

useSeoMeta({
  title: () => pageTitle.value,
  ogTitle: () => pageTitle.value,
  description: () => pageDescription.value,
  ogDescription: () => pageDescription.value,
  robots: 'noindex, nofollow',
})

const form = reactive({
  width: 0,
  height: 0,
  title: '',
  description: '',
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

const submitting = ref(false)
const selectedFile = ref<File | null>(null)
const previewUrl = ref<string>('')
const fileInputEl = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)
const aspectRatioStyle = computed(() => (form.width > 0 && form.height > 0 ? `${form.width} / ${form.height}` : '4 / 3'))
const captureTimeLocal = ref<string>('')
interface SelectOption {
  label: string
  value: string
}

const exposureProgramOptions = computed<SelectOption[]>(() => [
  { label: t('admin.upload.options.exposureProgram.notDefined'), value: 'Not defined' },
  { label: t('admin.upload.options.exposureProgram.manual'), value: 'Manual' },
  { label: t('admin.upload.options.exposureProgram.program'), value: 'Program' },
  { label: t('admin.upload.options.exposureProgram.aperturePriority'), value: 'Aperture priority' },
  { label: t('admin.upload.options.exposureProgram.shutterPriority'), value: 'Shutter priority' },
  { label: t('admin.upload.options.exposureProgram.creative'), value: 'Creative' },
  { label: t('admin.upload.options.exposureProgram.action'), value: 'Action' },
  { label: t('admin.upload.options.exposureProgram.portrait'), value: 'Portrait' },
  { label: t('admin.upload.options.exposureProgram.landscape'), value: 'Landscape' },
])

const exposureModeOptions = computed<SelectOption[]>(() => [
  { label: t('admin.upload.options.exposureMode.auto'), value: 'Auto' },
  { label: t('admin.upload.options.exposureMode.manual'), value: 'Manual' },
  { label: t('admin.upload.options.exposureMode.bracket'), value: 'Auto bracket' },
])

const meteringModeOptions = computed<SelectOption[]>(() => [
  { label: t('admin.upload.options.metering.unknown'), value: 'Unknown' },
  { label: t('admin.upload.options.metering.average'), value: 'Average' },
  { label: t('admin.upload.options.metering.center'), value: 'Center-weighted' },
  { label: t('admin.upload.options.metering.spot'), value: 'Spot' },
  { label: t('admin.upload.options.metering.multiSpot'), value: 'Multi-spot' },
  { label: t('admin.upload.options.metering.pattern'), value: 'Pattern' },
  { label: t('admin.upload.options.metering.partial'), value: 'Partial' },
  { label: t('admin.upload.options.metering.other'), value: 'Other' },
])

const whiteBalanceOptions = computed<SelectOption[]>(() => [
  { label: t('admin.upload.options.whiteBalance.auto'), value: 'Auto' },
  { label: t('admin.upload.options.whiteBalance.manual'), value: 'Manual' },
])

const flashOptions = computed<SelectOption[]>(() => [
  { label: t('admin.upload.options.flash.didNotFire'), value: 'Did not fire' },
  { label: t('admin.upload.options.flash.autoDidNotFire'), value: 'Auto (did not fire)' },
  { label: t('admin.upload.options.flash.fired'), value: 'Fired' },
  { label: t('admin.upload.options.flash.autoFired'), value: 'Auto (fired)' },
])
let pasteListener: ((event: ClipboardEvent) => void) | null = null

function normalizeToOption(value: string | undefined, options: SelectOption[], aliases: Record<string, string> = {}): string {
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

function clearSelectedFile(): void {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
  }
  previewUrl.value = ''
  selectedFile.value = null
  form.width = 0
  form.height = 0
  if (fileInputEl.value) {
    fileInputEl.value.value = ''
  }
}

async function detectImageSize(): Promise<void> {
  if (typeof globalThis.Image !== 'function') {
    return
  }
  if (!selectedFile.value) {
    toast.add({ title: toastMessages.value.selectImage, color: 'warning' })
    return
  }

  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
  }
  const objectUrl = URL.createObjectURL(selectedFile.value)
  previewUrl.value = objectUrl

  try {
    const size = await new Promise<{ width: number, height: number }>((resolve, reject) => {
      const img = new Image()
      img.addEventListener('load', () => resolve({ width: img.naturalWidth, height: img.naturalHeight }))
      img.addEventListener('error', () => reject(new Error(t('admin.upload.toast.sizeReadError'))))
      img.src = objectUrl
    })

    form.width = size.width
    form.height = size.height
  }
  catch (error) {
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

const pad = (value: number): string => value.toString().padStart(2, '0')

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

function toLocalInputString(isoString: string): string {
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  const hours = pad(date.getHours())
  const minutes = pad(date.getMinutes())
  const seconds = pad(date.getSeconds())
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`
}

function toIsoWithOffset(localString: string): string {
  const date = new Date(localString)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  const offsetMinutes = -date.getTimezoneOffset()
  const sign = offsetMinutes >= 0 ? '+' : '-'
  const abs = Math.abs(offsetMinutes)
  const offsetHours = pad(Math.floor(abs / 60))
  const offsetMins = pad(abs % 60)
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  const hours = pad(date.getHours())
  const minutes = pad(date.getMinutes())
  const seconds = pad(date.getSeconds())
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${sign}${offsetHours}:${offsetMins}`
}

async function extractExif(): Promise<void> {
  if (!selectedFile.value) {
    return
  }
  try {
    const parsed = (await exifr.parse(selectedFile.value, [
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

    if (!parsed) {
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

    const parts: string[] = []
    if (model) {
      parts.push(model)
    }
    if (lens) {
      parts.push(lens)
    }
    if (locationText) {
      parts.push(locationText)
    }
    if (description) {
      parts.push(description)
    }
    const exposureParts: string[] = []
    if (focal) {
      exposureParts.push(focal)
    }
    if (aperture) {
      exposureParts.push(aperture)
    }
    if (shutter) {
      exposureParts.push(shutter)
    }
    if (iso) {
      exposureParts.push(`ISO ${iso}`)
    }
    if (exposureParts.length > 0) {
      parts.push(exposureParts.join(' · '))
    }
  }
  catch (error) {
    const message = error instanceof Error ? error.message : toastMessages.value.exifFailedFallback
    toast.add({ title: toastMessages.value.exifFailed, description: message, color: 'warning' })
  }
}

async function refreshMetadata(): Promise<void> {
  await detectImageSize()
  await extractExif()
}

async function handleFileSelect(file: File | null): Promise<void> {
  clearSelectedFile()
  if (!file) {
    return
  }
  selectedFile.value = file
  await refreshMetadata()
}

async function handleFileChange(event: Event): Promise<void> {
  const target = event.target as HTMLInputElement | null
  await handleFileSelect(target?.files?.[0] ?? null)
}

async function handleDrop(event: DragEvent): Promise<void> {
  event.preventDefault()
  isDragging.value = false
  const file = event.dataTransfer?.files?.[0]
  await handleFileSelect(file ?? null)
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
  await handleFileSelect(file)
}

watch(
  () => captureTimeLocal.value,
  (value) => {
    form.captureTime = value ? toIsoWithOffset(value) : ''
  },
)

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

async function submit(): Promise<void> {
  if (!selectedFile.value) {
    toast.add({ title: toastMessages.value.selectImage, color: 'warning' })
    return
  }

  if (form.width <= 0 || form.height <= 0) {
    toast.add({ title: toastMessages.value.readSize, color: 'warning' })
    return
  }

  submitting.value = true
  try {
    const formData = new FormData()
    formData.append('file', selectedFile.value)
    formData.append('width', String(form.width))
    formData.append('height', String(form.height))
    formData.append('title', form.title)
    formData.append('description', form.description)
    formData.append('fanworkTitle', '')
    formData.append('characters', '')
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

    await $fetch('/api/files', {
      method: 'POST',
      body: formData,
    })
    toast.add({ title: toastMessages.value.saveSuccessTitle, description: toastMessages.value.saveSuccessDescription, color: 'primary' })
    clearSelectedFile()
    resetOptionalFields()
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
  clearSelectedFile()
})
</script>

<template>
  <div class="min-h-screen">
    <UContainer class="space-y-8 py-10">
      <AdminNav />

      <header class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="flex items-center gap-2 text-sm">
            <Icon name="mdi:cog-outline" class="h-4 w-4 text-primary" />
            <span>{{ t('admin.nav.label') }}</span>
          </p>
          <h1 class="flex items-center gap-2 text-3xl font-semibold">
            <Icon name="mdi:database-outline" class="h-6 w-6 text-primary" />
            <span>{{ t('admin.upload.title') }}</span>
          </h1>
          <p class="text-sm">
            {{ t('admin.upload.subtitle') }}
          </p>
        </div>
      </header>

      <input ref="fileInputEl" type="file" accept="image/*" class="hidden" @change="handleFileChange">

      <div v-if="!selectedFile" class="grid gap-6">
        <UCard>
          <template #header>
            <div class="space-y-1">
              <p class="flex items-center gap-2 text-sm">
                <Icon name="mdi:upload-outline" class="h-4 w-4 text-primary" />
                <span>{{ t('admin.upload.sections.upload.label') }}</span>
              </p>
              <h2 class="flex items-center gap-2 text-xl font-semibold">
                <Icon name="mdi:cursor-default-click-outline" class="h-5 w-5 text-primary" />
                <span>{{ t('admin.upload.sections.upload.title') }}</span>
              </h2>
              <p class="text-sm">
                {{ t('admin.upload.sections.upload.description') }}
              </p>
            </div>
          </template>
          <div
            class="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed p-10 text-center transition"
            :class="{ 'opacity-80': isDragging }"
            @dragover.prevent="isDragging = true"
            @dragleave.prevent="isDragging = false"
            @drop="handleDrop"
            @click="fileInputEl?.click()"
          >
            <Icon name="mdi:cloud-upload-outline" class="h-10 w-10 text-primary" />
            <p class="mt-3 text-sm">
              {{ t('admin.upload.sections.upload.dropHint') }}
            </p>
            <p class="text-xs">
              {{ t('admin.upload.sections.upload.supported') }}
            </p>
            <p class="text-xs">
              {{ t('admin.upload.sections.upload.pasteHint') }}
            </p>
          </div>
        </UCard>
      </div>

      <div v-if="selectedFile" class="grid gap-6 xl:grid-cols-[420px,1fr]">
        <UCard>
          <template #header>
            <div class="space-y-1">
              <p class="flex items-center gap-2 text-sm">
                <Icon name="mdi:image-search-outline" class="h-4 w-4 text-primary" />
                <span>{{ t('admin.upload.sections.preview.label') }}</span>
              </p>
              <h2 class="flex items-center gap-2 text-xl font-semibold">
                <Icon name="mdi:image-multiple-outline" class="h-5 w-5 text-primary" />
                <span>{{ t('admin.upload.sections.preview.title') }}</span>
              </h2>
            </div>
          </template>
          <div class="space-y-4">
            <div class="space-y-3">
              <div
                class="w-full cursor-pointer overflow-hidden rounded-lg bg-black/5 outline-none ring-primary/40 focus-visible:ring-2"
                :style="{ aspectRatio: aspectRatioStyle }"
                role="button"
                tabindex="0"
                :aria-label="t('common.actions.changeImage')"
                @click="fileInputEl?.click()"
                @keydown.enter.prevent="fileInputEl?.click()"
                @keydown.space.prevent="fileInputEl?.click()"
              >
                <img v-if="previewUrl" :src="previewUrl" :alt="t('admin.upload.sections.preview.alt')" class="h-full w-full object-cover">
              </div>
            </div>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <div class="space-y-1">
              <p class="flex items-center gap-2 text-sm">
                <Icon name="mdi:note-edit-outline" class="h-4 w-4 text-primary" />
                <span>{{ t('admin.upload.sections.edit.label') }}</span>
              </p>
              <h2 class="flex items-center gap-2 text-xl font-semibold">
                <Icon name="mdi:database-edit-outline" class="h-5 w-5 text-primary" />
                <span>{{ t('admin.upload.sections.edit.title') }}</span>
              </h2>
            </div>
          </template>
          <UForm :state="form" class="space-y-6" @submit.prevent="submit">
            <section class="space-y-3 rounded-xl bg-default/70 p-4 shadow-sm backdrop-blur">
              <div class="flex items-center gap-2">
                <Icon name="mdi:shape-outline" class="h-4 w-4 text-primary" />
                <div>
                  <p class="text-xs font-semibold uppercase tracking-wide text-neutral-500">基本信息</p>
                  <p class="text-sm text-neutral-600">尺寸、时间与标题描述</p>
                </div>
              </div>
              <div class="grid gap-3 md:grid-cols-2">
                <UFormField :label="t('admin.upload.fields.width.label')" name="width" :description="t('admin.upload.fields.width.description')">
                  <UInput v-model.number="form.width" type="number" min="1" :placeholder="t('admin.upload.fields.width.placeholder')" />
                </UFormField>
                <UFormField :label="t('admin.upload.fields.height.label')" name="height" :description="t('admin.upload.fields.height.description')">
                  <UInput v-model.number="form.height" type="number" min="1" :placeholder="t('admin.upload.fields.height.placeholder')" />
                </UFormField>
                <UFormField class="md:col-span-2" :label="t('admin.upload.fields.captureTime.label')" name="captureTime">
                  <UInput v-model="captureTimeLocal" type="datetime-local" step="1" :placeholder="t('admin.upload.fields.captureTime.placeholder')" />
                  <template #description>
                    <span class="text-xs">{{ t('admin.upload.fields.captureTime.description') }}</span>
                  </template>
                </UFormField>
                <UFormField :label="t('admin.upload.fields.title.label')" name="title">
                  <UInput v-model="form.title" :placeholder="t('admin.upload.fields.title.placeholder')" />
                </UFormField>
                <UFormField class="md:col-span-2" :label="t('admin.upload.fields.description.label')" name="description">
                  <UTextarea v-model="form.description" :placeholder="t('admin.upload.fields.description.placeholder')" :rows="3" />
                </UFormField>
              </div>
            </section>

            <section class="space-y-3 rounded-xl bg-default/70 p-4 shadow-sm backdrop-blur">
              <div class="flex items-center gap-2">
                <Icon name="mdi:camera-outline" class="h-4 w-4 text-primary" />
                <div>
                  <p class="text-xs font-semibold uppercase tracking-wide text-neutral-500">拍摄参数</p>
                  <p class="text-sm text-neutral-600">机身、镜头与曝光设定</p>
                </div>
              </div>
              <div class="grid gap-3 md:grid-cols-2">
                <UFormField :label="t('admin.upload.fields.cameraModel.label')" name="cameraModel">
                  <UInput v-model="form.cameraModel" :placeholder="t('admin.upload.fields.cameraModel.placeholder')" />
                </UFormField>
                <UFormField :label="t('admin.upload.fields.lensModel.label')" name="lensModel">
                  <UInput v-model="form.lensModel" :placeholder="t('admin.upload.fields.lensModel.placeholder')" />
                </UFormField>
              </div>
              <div class="grid gap-3 md:grid-cols-3">
                <UFormField :label="t('admin.upload.fields.aperture.label')" name="aperture">
                  <UInput v-model="form.aperture" :placeholder="t('admin.upload.fields.aperture.placeholder')" />
                </UFormField>
                <UFormField :label="t('admin.upload.fields.shutterSpeed.label')" name="shutterSpeed">
                  <UInput v-model="form.shutterSpeed" :placeholder="t('admin.upload.fields.shutterSpeed.placeholder')" />
                </UFormField>
                <UFormField name="iso" label="ISO">
                  <UInput v-model="form.iso" placeholder="800" />
                </UFormField>
                <UFormField :label="t('admin.upload.fields.focalLength.label')" name="focalLength">
                  <UInput v-model="form.focalLength" :placeholder="t('admin.upload.fields.focalLength.placeholder')" />
                </UFormField>
                <UFormField :label="t('admin.upload.fields.exposureBias.label')" name="exposureBias">
                  <UInput v-model="form.exposureBias" :placeholder="t('admin.upload.fields.exposureBias.placeholder')" />
                </UFormField>
                <UFormField :label="t('admin.upload.fields.exposureProgram.label')" name="exposureProgram">
                  <USelect
                    v-model="form.exposureProgram"
                    :items="exposureProgramOptions"
                    value-attribute="value"
                    option-attribute="label"
                    :placeholder="t('admin.upload.fields.exposureProgram.placeholder')"
                  />
                </UFormField>
                <UFormField :label="t('admin.upload.fields.exposureMode.label')" name="exposureMode">
                  <USelect
                    v-model="form.exposureMode"
                    :items="exposureModeOptions"
                    value-attribute="value"
                    option-attribute="label"
                    :placeholder="t('admin.upload.fields.exposureMode.placeholder')"
                  />
                </UFormField>
                <UFormField :label="t('admin.upload.fields.meteringMode.label')" name="meteringMode">
                  <USelect
                    v-model="form.meteringMode"
                    :items="meteringModeOptions"
                    value-attribute="value"
                    option-attribute="label"
                    :placeholder="t('admin.upload.fields.meteringMode.placeholder')"
                  />
                </UFormField>
                <UFormField :label="t('admin.upload.fields.whiteBalance.label')" name="whiteBalance">
                  <USelect
                    v-model="form.whiteBalance"
                    :items="whiteBalanceOptions"
                    value-attribute="value"
                    option-attribute="label"
                    :placeholder="t('admin.upload.fields.whiteBalance.placeholder')"
                  />
                </UFormField>
                <UFormField :label="t('admin.upload.fields.flash.label')" name="flash">
                  <USelect
                    v-model="form.flash"
                    :items="flashOptions"
                    value-attribute="value"
                    option-attribute="label"
                    :placeholder="t('admin.upload.fields.flash.placeholder')"
                  />
                </UFormField>
              </div>
            </section>

            <section class="space-y-3 rounded-xl bg-default/70 p-4 shadow-sm backdrop-blur">
              <div class="flex items-center gap-2">
                <Icon name="mdi:palette-outline" class="h-4 w-4 text-primary" />
                <div>
                  <p class="text-xs font-semibold uppercase tracking-wide text-neutral-500">输出与色彩</p>
                  <p class="text-sm text-neutral-600">色彩空间与分辨率</p>
                </div>
              </div>
              <div class="grid gap-3 md:grid-cols-2">
                <UFormField :label="t('admin.upload.fields.colorSpace.label')" name="colorSpace">
                  <UInput v-model="form.colorSpace" :placeholder="t('admin.upload.fields.colorSpace.placeholder')" />
                </UFormField>
                <UFormField :label="t('admin.upload.fields.resolutionUnit.label')" name="resolutionUnit">
                  <UInput v-model="form.resolutionUnit" :placeholder="t('admin.upload.fields.resolutionUnit.placeholder')" />
                </UFormField>
                <UFormField :label="t('admin.upload.fields.resolutionX.label')" name="resolutionX">
                  <UInput v-model="form.resolutionX" :placeholder="t('admin.upload.fields.resolutionX.placeholder')" />
                </UFormField>
                <UFormField :label="t('admin.upload.fields.resolutionY.label')" name="resolutionY">
                  <UInput v-model="form.resolutionY" :placeholder="t('admin.upload.fields.resolutionY.placeholder')" />
                </UFormField>
                <UFormField class="md:col-span-2" :label="t('admin.upload.fields.software.label')" name="software">
                  <UInput v-model="form.software" :placeholder="t('admin.upload.fields.software.placeholder')" />
                </UFormField>
              </div>
            </section>

            <section class="space-y-3 rounded-xl bg-default/70 p-4 shadow-sm backdrop-blur">
              <div class="flex items-center gap-2">
                <Icon name="mdi:map-marker-outline" class="h-4 w-4 text-primary" />
                <div>
                  <p class="text-xs font-semibold uppercase tracking-wide text-neutral-500">位置信息</p>
                  <p class="text-sm text-neutral-600">地理标记与原始地址</p>
                </div>
              </div>
              <div class="grid gap-3 md:grid-cols-2">
                <UFormField :label="t('admin.upload.fields.locationName.label')" name="locationName">
                  <UInput v-model="form.locationName" :placeholder="t('admin.upload.fields.locationName.placeholder')" />
                </UFormField>
                <UFormField :label="t('admin.upload.fields.locationRaw.label')" name="locationRaw">
                  <UInput v-model="form.location" :placeholder="t('admin.upload.fields.locationRaw.placeholder')" />
                </UFormField>
              </div>
              <div class="grid gap-3 md:grid-cols-2">
                <UFormField :label="t('admin.upload.fields.latitude.label')" name="latitude">
                  <UInput v-model.number="form.latitude" type="number" step="0.000001" placeholder="39.9087" />
                </UFormField>
                <UFormField :label="t('admin.upload.fields.longitude.label')" name="longitude">
                  <UInput v-model.number="form.longitude" type="number" step="0.000001" placeholder="116.3975" />
                </UFormField>
              </div>
            </section>

            <section class="space-y-3 rounded-xl bg-default/70 p-4 shadow-sm backdrop-blur">
              <div class="flex items-center gap-2">
                <Icon name="mdi:note-text-outline" class="h-4 w-4 text-primary" />
                <div>
                  <p class="text-xs font-semibold uppercase tracking-wide text-neutral-500">附加说明</p>
                  <p class="text-sm text-neutral-600">备注信息便于后续检索</p>
                </div>
              </div>
              <UFormField :label="t('admin.upload.fields.notes.label')" name="notes">
                <UTextarea v-model="form.notes" :placeholder="t('admin.upload.fields.notes.placeholder')" :rows="2" />
              </UFormField>
            </section>

            <UButton color="primary" class="w-full" type="submit" :loading="submitting">
              <span class="flex w-full items-center justify-center gap-2">
                <Icon name="mdi:content-save-outline" class="h-5 w-5" />
                <span>{{ t('admin.upload.actions.save') }}</span>
              </span>
            </UButton>
          </UForm>
        </UCard>
      </div>
    </UContainer>
  </div>
</template>
