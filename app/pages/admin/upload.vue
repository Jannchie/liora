<script setup lang="ts">
import type { MediaFormState } from '~/types/admin'
import exifr from 'exifr'
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useExposureOptions } from '~/composables/useExposureOptions'
import { toLocalInputString } from '~/utils/datetime'

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
  geocodeMissingQuery: t('admin.upload.toast.geocodeMissingQuery'),
  geocodeFailedTitle: t('admin.upload.toast.geocodeFailedTitle'),
  geocodeFailedFallback: t('admin.upload.toast.geocodeFailedFallback'),
  geocodeNoResult: t('admin.upload.toast.geocodeNoResult'),
  geocodeAppliedTitle: t('admin.upload.toast.geocodeAppliedTitle'),
}))

useSeoMeta({
  title: () => pageTitle.value,
  ogTitle: () => pageTitle.value,
  description: () => pageDescription.value,
  ogDescription: () => pageDescription.value,
  robots: 'noindex, nofollow',
})

type UploadValue = File | null

const previewMaxHeight = 480
const uploadValue = ref<UploadValue>(null)
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

const submitting = ref(false)
const selectedFile = computed<File | null>(() => {
  return uploadValue.value ?? null
})
const previewUrl = ref<string>('')
const fileUploadRef = ref<{ inputRef?: HTMLInputElement | { value?: unknown } } | null>(null)
const aspectRatioStyle = computed(() => (form.width > 0 && form.height > 0 ? `${form.width} / ${form.height}` : '4 / 3'))
const captureTimeLocal = ref<string>('')
let pasteListener: ((event: ClipboardEvent) => void) | null = null
const {
  exposureProgramOptions,
  exposureModeOptions,
  meteringModeOptions,
  whiteBalanceOptions,
  flashOptions,
} = useExposureOptions()
let activeMetadataToken = 0

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

function clearFormForNewFile(): void {
  resetFileState()
  resetOptionalFields()
}

function clearSelectedFile(): void {
  clearFormForNewFile()
  setUploadValue(null)
}

function resetFileState(): void {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
  }
  previewUrl.value = ''
  form.width = 0
  form.height = 0
  const inputEl = getFileInputElement()
  if (inputEl) {
    inputEl.value = ''
  }
}

function getFileInputElement(): HTMLInputElement | null {
  const exposed = fileUploadRef.value?.inputRef
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

function openFileDialog(): void {
  getFileInputElement()?.click()
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

    await $fetch('/api/files', {
      method: 'POST',
      body: formData,
    })
    toast.add({ title: toastMessages.value.saveSuccessTitle, description: toastMessages.value.saveSuccessDescription, color: 'primary' })
    clearSelectedFile()
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
          <h1 class="flex items-center gap-2 text-3xl font-semibold">
            <Icon name="mdi:database-outline" class="h-6 w-6 text-primary" />
            <span>{{ t('admin.upload.title') }}</span>
          </h1>
        </div>
      </header>

      <div v-show="!selectedFile" class="grid gap-6">
        <UCard>
          <template #header>
            <div class="space-y-1">
              <h2 class="flex items-center gap-2 text-xl font-semibold">
                <Icon name="mdi:upload-outline" class="h-5 w-5 text-primary" />
                <span>{{ t('admin.upload.sections.upload.label') }}</span>
              </h2>
            </div>
          </template>
          <UFileUpload
            ref="fileUploadRef"
            v-model="uploadValue"
            accept="image/*"
            :label="t('admin.upload.sections.upload.dropHint')"
            :description="`${t('admin.upload.sections.upload.supported')} · ${t('admin.upload.sections.upload.pasteHint')}`"
            class="w-full"
          />
        </UCard>
      </div>

      <div v-if="selectedFile" class="grid gap-6 xl:grid-cols-[420px,1fr]">
        <UCard>
          <template #header>
            <div class="space-y-1">
              <h2 class="flex items-center gap-2 text-xl font-semibold">
                <Icon name="mdi:image-multiple-outline" class="h-5 w-5 text-primary" />
                <span>{{ t('admin.upload.sections.preview.title') }}</span>
              </h2>
            </div>
          </template>
          <div class="space-y-4">
            <div class="space-y-3">
              <div
                class="flex w-full cursor-pointer items-center justify-center rounded-lg bg-black/5 outline-none ring-primary/40 focus-visible:ring-2"
                :style="{ aspectRatio: aspectRatioStyle, maxHeight: `${previewMaxHeight}px` }"
                role="button"
                tabindex="0"
                :aria-label="t('common.actions.changeImage')"
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
              </div>
            </div>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <div class="space-y-1">
              <h2 class="flex items-center gap-2 text-xl font-semibold">
                <Icon name="mdi:database-edit-outline" class="h-5 w-5 text-primary" />
                <span>{{ t('admin.upload.sections.edit.title') }}</span>
              </h2>
            </div>
          </template>
          <UForm :state="form" class="space-y-6" @submit.prevent="submit">
            <AdminMetadataForm
              v-model:form="form"
              v-model:capture-time-local="captureTimeLocal"
            />

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
