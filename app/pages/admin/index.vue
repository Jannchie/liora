<script setup lang="ts">
import type { ImageSizes } from '@nuxt/image'
import type { FileKind, FileResponse } from '~/types/file'
import exifr from 'exifr'
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'

const toast = useToast()
const image = useImage()

definePageMeta({
  middleware: 'admin-auth',
})

const pageTitle = '管理后台 | Liora'
const pageDescription = '录入与维护作品与元数据的管理后台。'

useSeoMeta({
  title: pageTitle,
  ogTitle: pageTitle,
  description: pageDescription,
  ogDescription: pageDescription,
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

const probing = ref(false)
const extracting = ref(false)
const submitting = ref(false)
const loggingOut = ref(false)
const selectedFile = ref<File | null>(null)
const previewUrl = ref<string>('')
const fileInputEl = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)
const aspectRatioStyle = computed(() => (form.width > 0 && form.height > 0 ? `${form.width} / ${form.height}` : '4 / 3'))
const captureTimeLocal = ref<string>('')
const editCaptureTimeLocal = ref<string>('')
const editingFile = ref<FileResponse | null>(null)
const editModalOpen = ref(false)
const updating = ref(false)
const editCharactersText = ref<string>('')
const deletingId = ref<number | null>(null)
const deleteTarget = ref<FileResponse | null>(null)
const deleteModalOpen = ref(false)
const page = ref(1)
const pageSize = ref(10)

const { data: filesData, pending: pendingFiles, refresh, error: fetchError } = await useFetch<FileResponse[]>('/api/files', {
  default: () => [],
})

const files = computed<FileResponse[]>(() => filesData.value ?? [])
const isLoading = computed(() => pendingFiles.value)
const totalFiles = computed(() => files.value.length)
const pageCount = computed(() => Math.max(1, Math.ceil(totalFiles.value / pageSize.value)))
const paginatedFiles = computed<FileResponse[]>(() => {
  const start = (page.value - 1) * pageSize.value
  return files.value.slice(start, start + pageSize.value)
})

function resolvePreviewUrl(file: FileResponse): string {
  const thumbnail = file.thumbnailUrl.trim()
  if (thumbnail) {
    return thumbnail
  }
  return file.imageUrl
}

type ImageAttributes = ImageSizes & {
  src: string
  width?: number
  height?: number
}

function resolvePreviewImage(file: FileResponse): ImageAttributes {
  const source = resolvePreviewUrl(file)
  const modifiers = {
    width: 192,
    height: 112,
    format: 'webp',
    fit: 'cover',
  }
  const sizes = image.getSizes(source, {
    modifiers,
    sizes: '160px',
  })
  const resolvedSrc
    = sizes.src
    ?? image.getImage(source, {
      modifiers,
    }).url
  return {
    ...sizes,
    src: resolvedSrc,
    width: 192,
    height: 112,
  }
}

const tableColumns = [
  { id: 'preview', header: '预览', accessorFn: (row: FileResponse) => resolvePreviewUrl(row) },
  { accessorKey: 'title', id: 'title', header: '标题' },
  { accessorKey: 'kind', id: 'kind', header: '类型' },
  { id: 'size', header: '尺寸', accessorFn: (row: FileResponse) => `${row.width}×${row.height}` },
  { id: 'location', header: '地点', accessorFn: (row: FileResponse) => row.location },
  { id: 'captureTime', header: '拍摄时间', accessorFn: (row: FileResponse) => row.metadata.captureTime || row.createdAt },
  { accessorKey: 'createdAt', id: 'createdAt', header: '创建时间' },
  { id: 'actions', header: '操作', accessorFn: (row: FileResponse) => row.id },
]

const kindOptions = [
  { label: '摄影', value: 'PHOTOGRAPHY' },
  { label: '插画', value: 'PAINTING' },
]

function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return date.toLocaleString()
}

const editForm = reactive<EditableForm>({
  kind: 'PHOTOGRAPHY',
  title: '',
  description: '',
  width: 0,
  height: 0,
  fanworkTitle: '',
  characters: [],
  location: '',
  locationName: '',
  latitude: null,
  longitude: null,
  cameraModel: '',
  aperture: '',
  focalLength: '',
  iso: '',
  shutterSpeed: '',
  captureTime: '',
  notes: '',
})

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

function resetEditForm(): void {
  editForm.kind = 'PHOTOGRAPHY'
  editForm.title = ''
  editForm.description = ''
  editForm.width = 0
  editForm.height = 0
  editForm.fanworkTitle = ''
  editForm.characters = []
  editForm.location = ''
  editForm.locationName = ''
  editForm.latitude = null
  editForm.longitude = null
  editForm.cameraModel = ''
  editForm.aperture = ''
  editForm.focalLength = ''
  editForm.iso = ''
  editForm.shutterSpeed = ''
  editForm.captureTime = ''
  editCaptureTimeLocal.value = ''
  editForm.notes = ''
  editCharactersText.value = ''
}

watch(
  () => totalFiles.value,
  (count) => {
    const maxPage = Math.max(1, Math.ceil(count / pageSize.value))
    if (page.value > maxPage) {
      page.value = maxPage
    }
  },
  { immediate: true },
)

watch(
  () => editModalOpen.value,
  (value) => {
    if (!value) {
      editingFile.value = null
      resetEditForm()
    }
  },
)

watch(
  () => deleteModalOpen.value,
  (value) => {
    if (!value) {
      deleteTarget.value = null
    }
  },
)

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
    toast.add({ title: '请先选择图片文件', color: 'warning' })
    return
  }

  probing.value = true
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
  }
  const objectUrl = URL.createObjectURL(selectedFile.value)
  previewUrl.value = objectUrl

  try {
    const size = await new Promise<{ width: number, height: number }>((resolve, reject) => {
      const img = new Image()
      img.addEventListener('load', () => resolve({ width: img.naturalWidth, height: img.naturalHeight }))
      img.addEventListener('error', () => reject(new Error('无法读取图片尺寸')))
      img.src = objectUrl
    })

    form.width = size.width
    form.height = size.height
  }
  catch (error) {
    const message = error instanceof Error ? error.message : '读取失败'
    toast.add({ title: '获取尺寸失败', description: message, color: 'error' })
    URL.revokeObjectURL(objectUrl)
    previewUrl.value = ''
  }
  finally {
    probing.value = false
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

interface EditableForm {
  kind: FileKind
  title: string
  description: string
  width: number
  height: number
  fanworkTitle: string
  characters: string[]
  location: string
  locationName: string
  latitude: number | null
  longitude: number | null
  cameraModel: string
  aperture: string
  focalLength: string
  iso: string
  shutterSpeed: string
  captureTime: string
  notes: string
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
  extracting.value = true
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
    const message = error instanceof Error ? error.message : '读取元数据失败'
    toast.add({ title: '读取元数据失败', description: message, color: 'warning' })
  }
  finally {
    extracting.value = false
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

watch(
  () => editCaptureTimeLocal.value,
  (value) => {
    editForm.captureTime = value ? toIsoWithOffset(value) : ''
  },
)

async function submit(): Promise<void> {
  if (!selectedFile.value) {
    toast.add({ title: '请先选择图片文件', color: 'warning' })
    return
  }

  if (form.width <= 0 || form.height <= 0) {
    toast.add({ title: '请先获取尺寸', color: 'warning' })
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

    const created = await $fetch<FileResponse>('/api/files', {
      method: 'POST',
      body: formData,
    })

    filesData.value = [created, ...(filesData.value ?? [])]
    toast.add({ title: '已保存', description: '记录写入数据库成功。', color: 'primary' })
    clearSelectedFile()
    resetOptionalFields()
  }
  catch (error) {
    const message = error instanceof Error ? error.message : '提交失败'
    toast.add({ title: '保存失败', description: message, color: 'error' })
  }
  finally {
    submitting.value = false
  }
}

function fillEditForm(file: FileResponse): void {
  const metadata = file.metadata
  editForm.kind = file.kind
  editForm.title = file.title ?? ''
  editForm.description = file.description ?? ''
  editForm.width = file.width
  editForm.height = file.height
  editForm.fanworkTitle = metadata.fanworkTitle || file.fanworkTitle || ''
  editForm.characters = metadata.characters ?? file.characters ?? []
  editForm.location = metadata.location || file.location || ''
  editForm.locationName = metadata.locationName
  editForm.latitude = metadata.latitude
  editForm.longitude = metadata.longitude
  editForm.cameraModel = metadata.cameraModel || file.cameraModel || ''
  editForm.aperture = metadata.aperture
  editForm.focalLength = metadata.focalLength
  editForm.iso = metadata.iso
  editForm.shutterSpeed = metadata.shutterSpeed
  editForm.captureTime = metadata.captureTime
  editCaptureTimeLocal.value = metadata.captureTime ? toLocalInputString(metadata.captureTime) : ''
  editForm.notes = metadata.notes
  editCharactersText.value = editForm.characters.join(', ')
}

function openEdit(file: FileResponse): void {
  editingFile.value = file
  fillEditForm(file)
  editModalOpen.value = true
}

function closeEdit(): void {
  editModalOpen.value = false
  editingFile.value = null
  resetEditForm()
}

async function saveEdit(): Promise<void> {
  if (!editingFile.value) {
    return
  }
  const parsedCharacters = editCharactersText.value
    .split(/[,，\n]/)
    .map(item => item.trim())
    .filter(item => item.length > 0)
  updating.value = true
  try {
    const updated = await $fetch<FileResponse>(`/api/files/${editingFile.value.id}`, {
      method: 'PUT',
      body: { ...editForm, characters: parsedCharacters },
    })
    filesData.value = filesData.value?.map(item => (item.id === updated.id ? updated : item)) ?? [updated]
    toast.add({ title: '已更新', description: '记录已保存。', color: 'primary' })
    closeEdit()
  }
  catch (error) {
    const message = error instanceof Error ? error.message : '更新失败'
    toast.add({ title: '更新失败', description: message, color: 'error' })
  }
  finally {
    updating.value = false
  }
}

function openDelete(file: FileResponse): void {
  deleteTarget.value = file
  deleteModalOpen.value = true
}

async function confirmDelete(): Promise<void> {
  if (!deleteTarget.value) {
    return
  }
  deletingId.value = deleteTarget.value.id
  try {
    await $fetch(`/api/files/${deleteTarget.value.id}`, { method: 'DELETE' })
    filesData.value = filesData.value?.filter(item => item.id !== deleteTarget.value?.id) ?? []
    toast.add({ title: '已删除', description: '记录已移除。', color: 'primary' })
    deleteModalOpen.value = false
  }
  catch (error) {
    const message = error instanceof Error ? error.message : '删除失败'
    toast.add({ title: '删除失败', description: message, color: 'error' })
  }
  finally {
    deletingId.value = null
  }
}

async function handleLogout(): Promise<void> {
  loggingOut.value = true
  try {
    await $fetch('/api/auth/logout', { method: 'POST' })
    toast.add({ title: '已退出', description: '登录状态已清除。', color: 'primary' })
    await navigateTo('/admin/login')
  }
  catch (error) {
    const message = error instanceof Error ? error.message : '退出失败'
    toast.add({ title: '退出失败', description: message, color: 'error' })
  }
  finally {
    loggingOut.value = false
  }
}

async function handleRefresh(): Promise<void> {
  await refresh()
  page.value = 1
}

onBeforeUnmount(() => {
  clearSelectedFile()
})

watch(fetchError, (value) => {
  if (value) {
    toast.add({ title: '加载失败', description: value.message, color: 'error' })
  }
})
</script>

<template>
  <div class="min-h-screen">
    <UContainer class="space-y-8 py-10">
      <header class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="text-sm">
            后台
          </p>
          <h1 class="text-3xl font-semibold">
            作品录入
          </h1>
          <p class="text-sm">
            在此完成元数据填写与校验，主页仅展示瀑布流。
          </p>
        </div>
        <div class="flex items-center gap-2">
          <UButton to="/" variant="soft" color="primary" icon="i-heroicons-home">
            返回主页
          </UButton>
          <UButton
            variant="ghost"
            color="neutral"
            :loading="loggingOut"
            icon="i-heroicons-arrow-right-on-rectangle"
            @click="handleLogout"
          >
            退出登录
          </UButton>
          <UButton color="primary" variant="solid" :loading="isLoading" icon="i-heroicons-arrow-path" @click="handleRefresh">
            刷新数据
          </UButton>
        </div>
      </header>

      <input ref="fileInputEl" type="file" accept="image/*" class="hidden" @change="handleFileChange">

      <div v-if="!selectedFile" class="grid gap-6">
        <UCard>
          <template #header>
            <div class="space-y-1">
              <p class="text-sm">
                上传照片
              </p>
              <h2 class="text-xl font-semibold">
                拖拽或点击
              </h2>
              <p class="text-sm">
                上传前界面保持简洁，仅展示上传入口。
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
            <UIcon name="i-heroicons-cloud-arrow-up" class="h-10 w-10" />
            <p class="mt-3 text-sm">
              拖拽照片到此或点击选择文件
            </p>
            <p class="text-xs">
              支持 JPG/PNG 等常见格式
            </p>
          </div>
        </UCard>
      </div>

      <div v-else class="grid gap-6 xl:grid-cols-[420px,1fr]">
        <UCard>
          <template #header>
            <div class="space-y-1">
              <p class="text-sm">
                预览与自动填充
              </p>
              <h2 class="text-xl font-semibold">
                照片信息
              </h2>
            </div>
          </template>
          <div class="space-y-4">
            <div class="space-y-3">
              <div class="w-full overflow-hidden rounded-lg bg-black/5" :style="{ aspectRatio: aspectRatioStyle }">
                <img v-if="previewUrl" :src="previewUrl" alt="预览" class="h-full w-full object-cover">
              </div>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <UButton variant="ghost" color="neutral" @click="fileInputEl?.click()">
                更换图片
              </UButton>
              <UButton variant="ghost" color="neutral" icon="i-heroicons-x-mark" @click="clearSelectedFile">
                移除
              </UButton>
            </div>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <div class="space-y-1">
              <p class="text-sm">
                编辑与保存
              </p>
              <h2 class="text-xl font-semibold">
                完善元数据
              </h2>
            </div>
          </template>
          <UForm :state="form" class="space-y-4" @submit.prevent="submit">
            <div class="grid grid-cols-2 gap-3">
              <UFormField name="width" label="宽度" description="单位：px">
                <UInput v-model.number="form.width" type="number" min="1" placeholder="800" />
              </UFormField>
              <UFormField name="height" label="高度" description="单位：px">
                <UInput v-model.number="form.height" type="number" min="1" placeholder="1200" />
              </UFormField>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <UFormField name="aperture" label="光圈">
                <UInput v-model="form.aperture" placeholder="f/1.8" />
              </UFormField>
              <UFormField name="focalLength" label="焦距">
                <UInput v-model="form.focalLength" placeholder="35mm" />
              </UFormField>
              <UFormField name="shutterSpeed" label="快门">
                <UInput v-model="form.shutterSpeed" placeholder="1/125s" />
              </UFormField>
              <UFormField name="iso" label="ISO">
                <UInput v-model="form.iso" placeholder="800" />
              </UFormField>
            </div>

            <UFormField name="cameraModel" label="器材型号">
              <UInput v-model="form.cameraModel" placeholder="Fujifilm X100VI" />
            </UFormField>

            <UFormField name="location" label="拍摄地点">
              <div class="space-y-2">
                <UFormField name="locationName" label="标准地名">
                  <UInput v-model="form.locationName" placeholder="如：北京市东城区故宫博物院" />
                </UFormField>
                <UFormField name="locationRaw" label="自定义地名">
                  <UInput v-model="form.location" placeholder="可写简称或自定义" />
                </UFormField>
                <div class="grid grid-cols-2 gap-2 text-xs">
                  <UFormField name="latitude" label="纬度">
                    <UInput v-model.number="form.latitude" type="number" step="0.000001" placeholder="39.9087" />
                  </UFormField>
                  <UFormField name="longitude" label="经度">
                    <UInput v-model.number="form.longitude" type="number" step="0.000001" placeholder="116.3975" />
                  </UFormField>
                </div>
              </div>
            </UFormField>

            <UFormField name="captureTime" label="拍摄时间">
              <UInput v-model="captureTimeLocal" type="datetime-local" step="1" placeholder="选择拍摄时间" />
              <template #description>
                <span class="text-xs">输入本地时间，保存时会转换为含秒与时区的 ISO 字符串。</span>
              </template>
            </UFormField>

            <UFormField name="title" label="标题（可留空）">
              <UInput v-model="form.title" placeholder="未命名作品" />
            </UFormField>

            <UFormField name="description" label="介绍（可留空）">
              <UTextarea v-model="form.description" placeholder="一句话介绍作品或拍摄背景" :rows="3" />
            </UFormField>

            <UFormField name="notes" label="备注（可留空）">
              <UTextarea v-model="form.notes" placeholder="补充故事、参数或灵感关键词" :rows="2" />
            </UFormField>

            <UButton color="primary" class="w-full" type="submit" :loading="submitting">
              保存到数据库
            </UButton>
          </UForm>
        </UCard>
      </div>

      <section class="space-y-3">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm">
              预览
            </p>
            <h2 class="text-xl font-semibold">
              数据列表
            </h2>
          </div>
          <div class="text-sm text-neutral-500">
            共 {{ totalFiles }} 条记录
          </div>
        </div>
        <UCard>
          <UTable
            :columns="tableColumns"
            :data="paginatedFiles"
            :loading="isLoading"
            empty="暂无数据，先录入一条。"
          >
            <template #preview-cell="{ row }">
              <div class="h-14 w-24 overflow-hidden rounded-md bg-black/5">
                <img
                  :alt="row.original.title || '预览'"
                  loading="lazy"
                  class="h-full w-full object-cover"
                  v-bind="resolvePreviewImage(row.original)"
                >
              </div>
            </template>
            <template #title-cell="{ row }">
              <div class="space-y-1">
                <p class="font-medium leading-tight">
                  {{ row.original.title || '未命名' }}
                </p>
                <p v-if="row.original.description" class="text-xs text-neutral-500 line-clamp-2">
                  {{ row.original.description }}
                </p>
              </div>
            </template>
            <template #kind-cell="{ row }">
              <UBadge color="primary" variant="soft">
                {{ row.original.kind === 'PHOTOGRAPHY' ? '摄影' : '插画' }}
              </UBadge>
            </template>
            <template #size-cell="{ row }">
              <span class="text-sm text-neutral-600">{{ row.original.width }} × {{ row.original.height }}</span>
            </template>
            <template #location-cell="{ row }">
              <span class="text-sm text-neutral-600">
                {{ row.original.metadata.locationName || row.original.location || '—' }}
              </span>
            </template>
            <template #captureTime-cell="{ row }">
              <span class="text-sm text-neutral-600">
                {{ formatDateTime(row.original.metadata.captureTime || row.original.createdAt) || '—' }}
              </span>
            </template>
            <template #createdAt-cell="{ row }">
              <span class="text-sm text-neutral-600">
                {{ formatDateTime(row.original.createdAt) }}
              </span>
            </template>
            <template #actions-cell="{ row }">
              <div class="flex items-center gap-2">
                <UButton size="xs" variant="ghost" color="primary" icon="i-heroicons-pencil-square" @click="openEdit(row.original)">
                  编辑
                </UButton>
                <UButton
                  size="xs"
                  variant="ghost"
                  color="error"
                  icon="i-heroicons-trash"
                  :loading="deletingId === row.original.id"
                  @click="openDelete(row.original)"
                >
                  删除
                </UButton>
              </div>
            </template>
          </UTable>
          <div class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div class="text-sm text-neutral-500">
              第 {{ page }} / {{ pageCount }} 页
            </div>
            <UPagination v-model:page="page" :items-per-page="pageSize" :total="totalFiles" />
          </div>
        </UCard>
      </section>
    </UContainer>

    <UModal v-model:open="editModalOpen">
      <template #content>
        <UCard class="w-full max-w-4xl">
          <template #header>
            <div class="flex items-start justify-between">
              <div>
                <p class="text-sm">
                  编辑
                </p>
                <h3 class="text-lg font-semibold">
                  {{ editingFile?.title || '调整元数据' }}
                </h3>
                <p class="text-xs text-neutral-500">
                  更新尺寸、拍摄信息或备注。
                </p>
              </div>
              <UButton variant="ghost" color="neutral" icon="i-heroicons-x-mark" @click="closeEdit">
                关闭
              </UButton>
            </div>
          </template>
          <UForm :state="editForm" class="space-y-4" @submit.prevent="saveEdit">
            <div class="grid gap-3 sm:grid-cols-2">
              <UFormField name="kind" label="类型">
                <USelect v-model="editForm.kind" :options="kindOptions" />
              </UFormField>
              <UFormField name="captureTime" label="拍摄时间">
                <UInput v-model="editCaptureTimeLocal" type="datetime-local" step="1" placeholder="选择拍摄时间" />
              </UFormField>
            </div>

            <div class="grid gap-3 sm:grid-cols-2">
              <UFormField name="title" label="标题">
                <UInput v-model="editForm.title" placeholder="未命名作品" />
              </UFormField>
              <UFormField name="description" label="介绍">
                <UTextarea v-model="editForm.description" :rows="2" placeholder="一句话介绍" />
              </UFormField>
            </div>

            <div class="grid gap-3 sm:grid-cols-2">
              <UFormField name="fanworkTitle" label="作品名（同人/系列）">
                <UInput v-model="editForm.fanworkTitle" placeholder="系列或关联作品名称" />
              </UFormField>
              <UFormField name="characters" label="角色/标签">
                <UTextarea v-model="editCharactersText" :rows="2" placeholder="用逗号或换行分隔多个角色" />
              </UFormField>
            </div>

            <div class="grid gap-3 sm:grid-cols-2">
              <UFormField name="width" label="宽度">
                <UInput v-model.number="editForm.width" type="number" min="1" placeholder="800" />
              </UFormField>
              <UFormField name="height" label="高度">
                <UInput v-model.number="editForm.height" type="number" min="1" placeholder="1200" />
              </UFormField>
            </div>

            <div class="grid gap-3 sm:grid-cols-2">
              <UFormField name="locationName" label="标准地名">
                <UInput v-model="editForm.locationName" placeholder="如：北京市东城区故宫博物院" />
              </UFormField>
              <UFormField name="location" label="自定义地名">
                <UInput v-model="editForm.location" placeholder="可写简称或自定义" />
              </UFormField>
            </div>

            <div class="grid gap-3 sm:grid-cols-2">
              <UFormField name="latitude" label="纬度">
                <UInput v-model.number="editForm.latitude" type="number" step="0.000001" placeholder="39.9087" />
              </UFormField>
              <UFormField name="longitude" label="经度">
                <UInput v-model.number="editForm.longitude" type="number" step="0.000001" placeholder="116.3975" />
              </UFormField>
            </div>

            <UFormField name="cameraModel" label="器材型号">
              <UInput v-model="editForm.cameraModel" placeholder="Fujifilm X100VI" />
            </UFormField>

            <div class="grid gap-3 sm:grid-cols-2">
              <UFormField name="aperture" label="光圈">
                <UInput v-model="editForm.aperture" placeholder="f/1.8" />
              </UFormField>
              <UFormField name="focalLength" label="焦距">
                <UInput v-model="editForm.focalLength" placeholder="35mm" />
              </UFormField>
            </div>

            <div class="grid gap-3 sm:grid-cols-2">
              <UFormField name="shutterSpeed" label="快门">
                <UInput v-model="editForm.shutterSpeed" placeholder="1/125s" />
              </UFormField>
              <UFormField name="iso" label="ISO">
                <UInput v-model="editForm.iso" placeholder="800" />
              </UFormField>
            </div>

            <UFormField name="notes" label="备注">
              <UTextarea v-model="editForm.notes" :rows="2" placeholder="补充故事或说明" />
            </UFormField>

            <div class="flex justify-end gap-2">
              <UButton variant="ghost" color="neutral" @click="closeEdit">
                取消
              </UButton>
              <UButton color="primary" type="submit" :loading="updating">
                保存
              </UButton>
            </div>
          </UForm>
        </UCard>
      </template>
    </UModal>

    <UModal v-model:open="deleteModalOpen">
      <template #content>
        <UCard class="w-full max-w-xl">
          <template #header>
            <div class="flex items-start justify-between">
              <div>
                <p class="text-sm text-error-500">
                  删除确认
                </p>
                <h3 class="text-lg font-semibold">
                  确认删除这条记录吗？
                </h3>
                <p class="text-xs text-neutral-500">
                  删除后将无法恢复，请确认。
                </p>
              </div>
              <UButton variant="ghost" color="neutral" icon="i-heroicons-x-mark" @click="deleteModalOpen = false">
                关闭
              </UButton>
            </div>
          </template>
          <div class="space-y-3">
            <p class="text-sm">
              标题：<span class="font-medium">{{ deleteTarget?.title || '未命名' }}</span>
            </p>
            <p class="text-sm text-neutral-600">
              创建时间：{{ deleteTarget ? formatDateTime(deleteTarget.createdAt) : '' }}
            </p>
          </div>
          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton variant="ghost" color="neutral" @click="deleteModalOpen = false">
                取消
              </UButton>
              <UButton color="error" :loading="deletingId !== null" @click="confirmDelete">
                确认删除
              </UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </div>
</template>
