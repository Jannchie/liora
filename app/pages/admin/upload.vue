<script setup lang="ts">
import type { FileKind } from '~/types/file'
import exifr from 'exifr'
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'

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
  kind: 'PHOTOGRAPHY' as FileKind,
  width: 0,
  height: 0,
  title: '',
  description: '',
  location: '',
  cameraModel: '',
  aperture: '',
  focalLength: '',
  iso: '',
  shutterSpeed: '',
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

function resetOptionalFields(): void {
  form.title = ''
  form.description = ''
  form.location = ''
  form.locationName = ''
  form.latitude = null
  form.longitude = null
  form.cameraModel = ''
  form.aperture = ''
  form.focalLength = ''
  form.iso = ''
  form.shutterSpeed = ''
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
  if (globalThis.window === undefined) {
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
    const captureTime = formatDate(parsed.DateTimeOriginal ?? parsed.CreateDate)

    if (model) {
      form.cameraModel = model
    }
    if (lens) {
      form.cameraModel = model ? `${model} · ${lens}` : lens
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

watch(
  () => captureTimeLocal.value,
  (value) => {
    form.captureTime = value ? toIsoWithOffset(value) : ''
  },
)

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
    formData.append('kind', form.kind)
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
    formData.append('aperture', form.aperture)
    formData.append('focalLength', form.focalLength)
    formData.append('iso', form.iso)
    formData.append('shutterSpeed', form.shutterSpeed)
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
              <div class="w-full overflow-hidden rounded-lg bg-black/5" :style="{ aspectRatio: aspectRatioStyle }">
                <img v-if="previewUrl" :src="previewUrl" :alt="t('admin.upload.sections.preview.alt')" class="h-full w-full object-cover">
              </div>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <UButton variant="ghost" color="neutral" @click="fileInputEl?.click()">
                <span class="flex items-center gap-2">
                  <Icon name="mdi:image-edit-outline" class="h-4 w-4" />
                  <span>{{ t('common.actions.changeImage') }}</span>
                </span>
              </UButton>
              <UButton variant="ghost" color="neutral" @click="clearSelectedFile">
                <span class="flex items-center gap-2">
                  <Icon name="mdi:trash-can-outline" class="h-4 w-4" />
                  <span>{{ t('common.actions.remove') }}</span>
                </span>
              </UButton>
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
          <UForm :state="form" class="space-y-4" @submit.prevent="submit">
            <div class="grid grid-cols-2 gap-3">
              <UFormField :label="t('admin.upload.fields.width.label')" name="width" :description="t('admin.upload.fields.width.description')">
                <UInput v-model.number="form.width" type="number" min="1" :placeholder="t('admin.upload.fields.width.placeholder')" />
              </UFormField>
              <UFormField :label="t('admin.upload.fields.height.label')" name="height" :description="t('admin.upload.fields.height.description')">
                <UInput v-model.number="form.height" type="number" min="1" :placeholder="t('admin.upload.fields.height.placeholder')" />
              </UFormField>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <UFormField :label="t('admin.upload.fields.aperture.label')" name="aperture">
                <UInput v-model="form.aperture" :placeholder="t('admin.upload.fields.aperture.placeholder')" />
              </UFormField>
              <UFormField :label="t('admin.upload.fields.focalLength.label')" name="focalLength">
                <UInput v-model="form.focalLength" :placeholder="t('admin.upload.fields.focalLength.placeholder')" />
              </UFormField>
              <UFormField :label="t('admin.upload.fields.shutterSpeed.label')" name="shutterSpeed">
                <UInput v-model="form.shutterSpeed" :placeholder="t('admin.upload.fields.shutterSpeed.placeholder')" />
              </UFormField>
              <UFormField name="iso" label="ISO">
                <UInput v-model="form.iso" placeholder="800" />
              </UFormField>
            </div>

            <UFormField :label="t('admin.upload.fields.cameraModel.label')" name="cameraModel">
              <UInput v-model="form.cameraModel" :placeholder="t('admin.upload.fields.cameraModel.placeholder')" />
            </UFormField>

            <UFormField :label="t('admin.upload.fields.location.label')" name="location">
              <div class="space-y-2">
                <UFormField :label="t('admin.upload.fields.locationName.label')" name="locationName">
                  <UInput v-model="form.locationName" :placeholder="t('admin.upload.fields.locationName.placeholder')" />
                </UFormField>
                <UFormField :label="t('admin.upload.fields.locationRaw.label')" name="locationRaw">
                  <UInput v-model="form.location" :placeholder="t('admin.upload.fields.locationRaw.placeholder')" />
                </UFormField>
                <div class="grid grid-cols-2 gap-2 text-xs">
                  <UFormField :label="t('admin.upload.fields.latitude.label')" name="latitude">
                    <UInput v-model.number="form.latitude" type="number" step="0.000001" placeholder="39.9087" />
                  </UFormField>
                  <UFormField :label="t('admin.upload.fields.longitude.label')" name="longitude">
                    <UInput v-model.number="form.longitude" type="number" step="0.000001" placeholder="116.3975" />
                  </UFormField>
                </div>
              </div>
            </UFormField>

            <UFormField :label="t('admin.upload.fields.captureTime.label')" name="captureTime">
              <UInput v-model="captureTimeLocal" type="datetime-local" step="1" :placeholder="t('admin.upload.fields.captureTime.placeholder')" />
              <template #description>
                <span class="text-xs">{{ t('admin.upload.fields.captureTime.description') }}</span>
              </template>
            </UFormField>

            <UFormField :label="t('admin.upload.fields.title.label')" name="title">
              <UInput v-model="form.title" :placeholder="t('admin.upload.fields.title.placeholder')" />
            </UFormField>

            <UFormField :label="t('admin.upload.fields.description.label')" name="description">
              <UTextarea v-model="form.description" :placeholder="t('admin.upload.fields.description.placeholder')" :rows="3" />
            </UFormField>

            <UFormField :label="t('admin.upload.fields.notes.label')" name="notes">
              <UTextarea v-model="form.notes" :placeholder="t('admin.upload.fields.notes.placeholder')" :rows="2" />
            </UFormField>

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
