<script setup lang="ts">
import type { MediaFormState } from '~/types/admin'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useAdminUploadForm } from '~/composables/useAdminUploadForm'
import { useExifExtraction } from '~/composables/useExifExtraction'
import { useLivePhotoFrame } from '~/composables/useLivePhotoFrame'
import { useUploadProcessingPoll } from '~/composables/useUploadProcessingPoll'
import { useUploadTransport } from '~/composables/useUploadTransport'
import { createEmptyMediaFormState } from '~/utils/media-form'

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
  batchSelectFiles: t('admin.upload.toast.batchSelectFiles'),
  batchSelectTarget: t('admin.upload.toast.batchSelectTarget'),
  batchSelectFields: t('admin.upload.toast.batchSelectFields'),
  batchApplyDone: t('admin.upload.toast.batchApplyDone'),
  batchUploadDone: t('admin.upload.toast.batchUploadDone'),
  batchUploadFailed: t('admin.upload.toast.batchUploadFailed'),
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

const { form, formModel, resetOptionalFields } = useAdminUploadForm()
const {
  uploadSpeed,
  uploadBytesSent,
  uploadTotalBytes,
  uploadProgressPercent,
  resetUploadMetrics,
  sendFileWithProgress,
} = useUploadTransport()
const { startProcessingStatusPoll, stopProcessingStatusPoll } = useUploadProcessingPoll(toast)
const { extractExif } = useExifExtraction()
const requestFetchForUpload = requestFetch as unknown as Parameters<typeof sendFileWithProgress>[0]['requestFetch']
const requestFetchForPoll = requestFetch as unknown as Parameters<typeof startProcessingStatusPoll>[1]

const submitting = ref(false)
const selectedFile = computed<File | null>(() => uploadValue.value ?? null)
const selectedVideo = computed<File | null>(() => videoValue.value ?? null)
const hasSelection = computed<boolean>(() => Boolean(selectedFile.value || selectedVideo.value))
const isLiveMode = computed<boolean>(() => uploadMode.value === 'live')
const previewUrl = ref<string>('')
const fileUploadRef = ref<{ inputRef?: HTMLInputElement | { value?: unknown } } | null>(null)
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
const selectedFileName = computed(() => selectedFile.value?.name ?? t('common.labels.untitled'))
const selectedVideoName = computed(() => selectedVideo.value?.name ?? t('common.labels.untitled'))
const displayFileName = computed(() => {
  if (isLiveMode.value && selectedVideo.value) {
    return selectedVideoName.value
  }
  return selectedFileName.value
})
const changePrimaryLabel = computed(() => (isLiveMode.value ? t('common.actions.changeVideo') : t('common.actions.changeImage')))
const uploadSpeedText = computed(() => formatSpeed(uploadSpeed.value))
const uploadTotalText = computed(() => formatFileSize(uploadTotalBytes.value))
const uploadedBytesText = computed(() => formatFileSize(uploadBytesSent.value))
const isUploading = computed(() => submitting.value)

type BatchUploadStatus = 'pending' | 'uploading' | 'success' | 'failed'

interface BatchUploadItem {
  id: string
  file: File
  previewUrl: string
  form: MediaFormState
  selected: boolean
  status: BatchUploadStatus
  errorMessage: string
}

const batchInputRef = ref<HTMLInputElement | null>(null)
const batchItems = ref<BatchUploadItem[]>([])
const batchSubmitting = ref(false)
const batchSelectedCount = computed(() => batchItems.value.filter(item => item.selected).length)
const batchPendingCount = computed(() => batchItems.value.filter(item => item.status === 'pending').length)
const batchUploadingCount = computed(() => batchItems.value.filter(item => item.status === 'uploading').length)
const batchSuccessCount = computed(() => batchItems.value.filter(item => item.status === 'success').length)
const batchFailedCount = computed(() => batchItems.value.filter(item => item.status === 'failed').length)

let activeMetadataToken = 0
const {
  videoPreviewUrl,
  liveFrameTime,
  liveFrameDuration,
  liveFramePending,
  setVideoElementRef,
  liveFrameTimeLabel,
  liveFrameDurationLabel,
  clearVideoSelection: clearLivePhotoSelection,
  handleVideoSelected,
  handleVideoMetadataLoaded,
  handleVideoError,
  handleFrameInput,
  captureLiveFrame,
} = useLivePhotoFrame({
  videoValue,
  setUploadValue,
  clearFormForNewFile,
  onVideoError: () => {
    toast.add({ title: toastMessages.value.videoFailed, color: 'error' })
  },
  onFrameError: (message) => {
    toast.add({ title: toastMessages.value.frameFailed, description: message, color: 'error' })
  },
  frameFailedFallback: () => toastMessages.value.frameFailed,
})

function setFileUploadRef(instance: unknown): void {
  fileUploadRef.value = (instance as { inputRef?: HTMLInputElement | { value?: unknown } }) ?? null
}

function clearSelectedFile(): void {
  clearFormForNewFile()
  setUploadValue(null)
  clearVideoSelection()
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

/**
 * Single entry point for the unified picker. Inspects MIME and routes:
 *   image/* → still-photo path (sets uploadValue, mode=image)
 *   video/* → live-photo path (sets videoValue, mode=live)
 *
 * Anything else is rejected with a toast. Used by the dropzone, the
 * "change file" affordance on the preview, and the paste handler.
 */
function ingestPickedFile(file: File | null): void {
  if (!file) {
    clearSelectedFile()
    return
  }
  if (file.type.startsWith('video/')) {
    if (uploadMode.value !== 'live') {
      setUploadMode('live')
    }
    videoValue.value = file
    return
  }
  if (file.type.startsWith('image/')) {
    if (uploadMode.value !== 'image') {
      setUploadMode('image')
    }
    setUploadValue(file)
    return
  }
  toast.add({ title: toastMessages.value.selectImage, color: 'error' })
}

function clearFormForNewFile(): void {
  resetFileState()
  resetOptionalFields(captureTimeLocal)
  resetUploadMetrics()
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
  clearLivePhotoSelection()
  const inputEl = getFileInputElement('video')
  if (inputEl) {
    inputEl.value = ''
  }
}

function getFileInputElement(_target?: 'image' | 'video'): HTMLInputElement | null {
  // Single picker now backs both modes; `target` is kept on the signature
  // purely so callers don't have to be touched, but both branches resolve
  // to the same physical <input> exposed by the unified dropzone.
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

async function refreshMetadata(file: File, token: number): Promise<void> {
  await detectImageSize(file, token)
  const result = await extractExif({
    file,
    token,
    isActiveToken: current => current === activeMetadataToken,
    form,
    captureTimeLocal,
    exifFailedFallback: toastMessages.value.exifFailedFallback,
  })
  if (result.errorMessage) {
    toast.add({ title: toastMessages.value.exifFailed, description: result.errorMessage, color: 'warning' })
  }
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
  ingestPickedFile(file)
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
    const { uploadId } = await sendFileWithProgress({
      imageFile: selectedFile.value,
      videoFile: selectedVideo.value,
      form,
      isLiveMode: isLiveMode.value,
      liveFrameTime: liveFrameTime.value,
      requestFetch: requestFetchForUpload,
    })
    clearSelectedFile()
    if (uploadId) {
      startProcessingStatusPoll(uploadId, requestFetchForPoll, {
        processing: toastMessages.value.processing,
        processingDescription: toastMessages.value.processingDescription,
        processingDoneTitle: toastMessages.value.processingDoneTitle,
        processingDoneDescription: toastMessages.value.processingDoneDescription,
        processingFailedTitle: toastMessages.value.processingFailedTitle,
        processingFailedDescription: toastMessages.value.processingFailedDescription,
      })
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

function openBatchFileDialog(): void {
  batchInputRef.value?.click()
}

function clearBatchQueue(): void {
  for (const item of batchItems.value) {
    if (item.previewUrl) {
      URL.revokeObjectURL(item.previewUrl)
    }
  }
  batchItems.value = []
}

function buildBatchItemId(file: File): string {
  return `${file.name}-${file.size}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

async function readImageSize(file: File): Promise<{ width: number, height: number, previewUrl: string }> {
  const preview = URL.createObjectURL(file)
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => {
      resolve({
        width: image.naturalWidth,
        height: image.naturalHeight,
        previewUrl: preview,
      })
    })
    image.addEventListener('error', () => {
      URL.revokeObjectURL(preview)
      reject(new Error(t('admin.upload.toast.sizeReadError')))
    })
    image.src = preview
  })
}

async function buildBatchItem(file: File): Promise<BatchUploadItem> {
  const formState = createEmptyMediaFormState()
  const { width, height, previewUrl } = await readImageSize(file)
  formState.width = width
  formState.height = height

  const exifResult = await extractExif({
    file,
    token: 1,
    isActiveToken: () => true,
    form: formState,
    captureTimeLocal: { value: '' },
    exifFailedFallback: toastMessages.value.exifFailedFallback,
  })
  if (exifResult.errorMessage) {
    toast.add({ title: toastMessages.value.exifFailed, description: exifResult.errorMessage, color: 'warning' })
  }

  return {
    id: buildBatchItemId(file),
    file,
    previewUrl,
    form: formState,
    selected: true,
    status: 'pending',
    errorMessage: '',
  }
}

async function handleBatchFilesPicked(event: Event): Promise<void> {
  const target = event.target as HTMLInputElement | null
  const files = target?.files ? [...target.files] : []
  if (files.length === 0) {
    return
  }

  const imageFiles = files.filter(file => file.type.startsWith('image/'))
  if (imageFiles.length === 0) {
    toast.add({ title: toastMessages.value.batchSelectFiles, color: 'warning' })
    return
  }

  for (const file of imageFiles) {
    try {
      const item = await buildBatchItem(file)
      batchItems.value.push(item)
    }
    catch (error) {
      const message = error instanceof Error ? error.message : toastMessages.value.sizeFailedFallback
      toast.add({ title: toastMessages.value.sizeFailed, description: message, color: 'error' })
    }
  }
  if (target) {
    target.value = ''
  }
}

function setAllBatchSelected(checked: boolean): void {
  batchItems.value = batchItems.value.map(item => ({
    ...item,
    selected: checked,
  }))
}

function removeBatchItem(itemId: string): void {
  const target = batchItems.value.find(item => item.id === itemId)
  if (target?.previewUrl) {
    URL.revokeObjectURL(target.previewUrl)
  }
  batchItems.value = batchItems.value.filter(item => item.id !== itemId)
}

async function submitBatchUpload(): Promise<void> {
  if (batchItems.value.length === 0) {
    toast.add({ title: toastMessages.value.batchSelectFiles, color: 'warning' })
    return
  }
  if (batchPendingCount.value === 0) {
    toast.add({ title: toastMessages.value.batchUploadDone, color: 'primary' })
    return
  }

  batchSubmitting.value = true
  for (const item of batchItems.value) {
    if (item.status !== 'pending') {
      continue
    }
    item.status = 'uploading'
    item.errorMessage = ''
    try {
      await sendFileWithProgress({
        imageFile: item.file,
        videoFile: null,
        form: item.form,
        isLiveMode: false,
        liveFrameTime: 0,
        requestFetch: requestFetchForUpload,
      })
      item.status = 'success'
    }
    catch (error) {
      item.status = 'failed'
      item.errorMessage = error instanceof Error ? error.message : toastMessages.value.saveFailedFallback
    }
  }
  batchSubmitting.value = false

  if (batchFailedCount.value > 0) {
    toast.add({
      title: toastMessages.value.batchUploadFailed,
      description: `${batchSuccessCount.value}/${batchItems.value.length}`,
      color: 'warning',
    })
    return
  }
  toast.add({ title: toastMessages.value.batchUploadDone, color: 'success' })
}

onBeforeUnmount(() => {
  const target = typeof globalThis.removeEventListener === 'function' ? (globalThis as unknown as Window) : null
  if (pasteListener && target) {
    target.removeEventListener('paste', pasteListener)
  }
  stopProcessingStatusPoll()
  clearSelectedFile()
  clearBatchQueue()
})
</script>

<template>
  <div class="min-h-screen">
    <UContainer rails class="space-y-10 py-10">
      <AdminNav />

      <UPageHeader
        :eyebrow="t('admin.nav.label')"
        icon="tabler:shield-check"
        :title="t('admin.upload.title')"
      >
        <template #actions>
          <UButton
            size="sm"
            color="primary"
            icon="tabler:photo-plus"
            @click="openBatchFileDialog"
          >
            {{ t('admin.upload.batch.pickFiles') }}
          </UButton>
          <UButton
            v-if="batchItems.length > 0"
            size="sm"
            color="neutral"
            variant="ghost"
            icon="tabler:trash"
            @click="clearBatchQueue"
          >
            {{ t('admin.upload.batch.clearQueue') }}
          </UButton>
        </template>
      </UPageHeader>

      <input
        ref="batchInputRef"
        type="file"
        accept="image/*"
        multiple
        class="hidden"
        @change="handleBatchFilesPicked"
      >
      <USection
        v-if="batchItems.length > 0"
        :label="t('admin.upload.batch.title')"
        icon="tabler:photo-plus"
      >
        <template #actions>
          <UButton size="xs" color="neutral" variant="ghost" @click="setAllBatchSelected(true)">
            {{ t('admin.upload.batch.selectAll') }}
          </UButton>
          <UButton size="xs" color="neutral" variant="ghost" @click="setAllBatchSelected(false)">
            {{ t('admin.upload.batch.selectNone') }}
          </UButton>
          <UButton
            size="xs"
            color="primary"
            icon="tabler:upload"
            :loading="batchSubmitting"
            @click="submitBatchUpload"
          >
            {{ t('admin.upload.batch.startUpload') }}
          </UButton>
        </template>
        <div class="space-y-4">
          <dl class="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs">
            <div class="flex items-center gap-1">
              <dt class="text-muted">
                Total
              </dt><dd class="num-tabular">
                {{ batchItems.length }}
              </dd>
            </div>
            <div class="flex items-center gap-1">
              <dt class="text-muted">
                Selected
              </dt><dd class="num-tabular">
                {{ batchSelectedCount }}
              </dd>
            </div>
            <div class="flex items-center gap-1">
              <dt class="text-muted">
                Pending
              </dt><dd class="num-tabular">
                {{ batchPendingCount }}
              </dd>
            </div>
            <div class="flex items-center gap-1">
              <dt class="text-muted">
                Uploading
              </dt><dd class="num-tabular">
                {{ batchUploadingCount }}
              </dd>
            </div>
            <div class="flex items-center gap-1">
              <dt class="text-muted">
                Success
              </dt><dd class="num-tabular text-success">
                {{ batchSuccessCount }}
              </dd>
            </div>
            <div class="flex items-center gap-1">
              <dt class="text-muted">
                Failed
              </dt><dd class="num-tabular text-error">
                {{ batchFailedCount }}
              </dd>
            </div>
          </dl>
          <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <div
              v-for="item in batchItems"
              :key="item.id"
              class="space-y-2"
            >
              <div class="relative">
                <img
                  :src="item.previewUrl"
                  :alt="item.file.name"
                  class="aspect-[4/3] w-full object-cover"
                >
                <UButton
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  icon="tabler:x"
                  class="absolute right-1 top-1 bg-default/80 backdrop-blur"
                  @click="removeBatchItem(item.id)"
                />
              </div>
              <div class="space-y-1">
                <label class="flex items-center gap-2 text-sm">
                  <input
                    v-model="item.selected"
                    type="checkbox"
                    class="h-4 w-4 accent-primary"
                  >
                  <span class="truncate font-medium">{{ item.file.name }}</span>
                </label>
                <div class="flex items-center justify-between num-tabular text-[11px] text-muted">
                  <span>{{ item.form.width }} × {{ item.form.height }}</span>
                  <span>{{ formatFileSize(item.file.size) }}</span>
                </div>
                <p class="text-[11px]" :class="item.status === 'failed' ? 'text-error' : 'text-muted'">
                  {{ t(`admin.upload.batch.status.${item.status}`) }}
                  <span v-if="item.errorMessage"> · {{ item.errorMessage }}</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </USection>

      <AdminUploadPickerCard
        v-show="!hasSelection"
        :set-file-upload-ref="setFileUploadRef"
        @pick="ingestPickedFile"
      />

      <UForm
        v-if="hasSelection"
        :state="form"
        class="space-y-4"
        @submit.prevent="submit"
      >
        <UCard class="overflow-hidden">
          <template #header>
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div class="min-w-0 space-y-1">
                <p class="label-caption">
                  {{ t('admin.upload.sections.edit.title') }}
                </p>
                <p class="truncate font-mono text-sm text-highlighted">
                  {{ displayFileName }}
                </p>
                <div
                  v-if="previewChips.length > 0"
                  class="flex flex-wrap items-center gap-x-4 gap-y-1 num-tabular text-[11px] text-muted"
                >
                  <span
                    v-for="chip in previewChips"
                    :key="`${chip.icon}-${chip.text}`"
                    class="inline-flex items-center gap-1.5"
                  >
                    <Icon :name="chip.icon" class="h-3.5 w-3.5" />
                    <span>{{ chip.text }}</span>
                  </span>
                </div>
              </div>
              <div class="flex shrink-0 flex-wrap items-center gap-2">
                <UButton
                  variant="ghost"
                  color="neutral"
                  type="button"
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
          </template>

          <div class="grid gap-6 xl:grid-cols-[minmax(360px,520px),1fr]">
            <AdminUploadPreviewCard
              :preview-max-height="previewMaxHeight"
              :aspect-ratio-style="aspectRatioStyle"
              :change-primary-label="changePrimaryLabel"
              :preview-url="previewUrl"
              :is-live-mode="isLiveMode"
              :selected-file-name="selectedFileName"
              :selected-file-type="selectedFile?.type ?? ''"
              :has-selected-file="Boolean(selectedFile)"
              :selected-video-name="selectedVideoName"
              :selected-video-type="selectedVideo?.type ?? ''"
              :has-selected-video="Boolean(selectedVideo)"
              :video-preview-url="videoPreviewUrl"
              :live-frame-duration-label="liveFrameDurationLabel"
              :live-frame-time-label="liveFrameTimeLabel"
              :live-frame-duration="liveFrameDuration"
              :live-frame-time="liveFrameTime"
              :live-frame-pending="liveFramePending"
              :is-uploading="isUploading"
              :upload-progress-percent="uploadProgressPercent"
              :uploaded-bytes-text="uploadedBytesText"
              :upload-total-bytes="uploadTotalBytes"
              :upload-total-text="uploadTotalText"
              :upload-speed-text="uploadSpeedText"
              :set-video-element-ref="setVideoElementRef"
              @open-file-dialog="openFileDialog"
              @video-metadata-loaded="handleVideoMetadataLoaded"
              @video-error="handleVideoError"
              @frame-input="handleFrameInput"
              @capture-live-frame="captureLiveFrame"
            />

            <AdminUploadMetadataCard
              v-model:form="formModel"
              v-model:capture-time-local="captureTimeLocal"
              :selected-file="selectedFile"
            />
          </div>
        </UCard>
      </UForm>
    </UContainer>
  </div>
</template>
