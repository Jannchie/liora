<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useAdminUploadForm } from '~/composables/useAdminUploadForm'
import { useExifExtraction } from '~/composables/useExifExtraction'
import { useLivePhotoFrame } from '~/composables/useLivePhotoFrame'
import { useUploadProcessingPoll } from '~/composables/useUploadProcessingPoll'
import { useUploadTransport } from '~/composables/useUploadTransport'

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

function setVideoUploadRef(instance: unknown): void {
  videoUploadRef.value = (instance as { inputRef?: HTMLInputElement | { value?: unknown } }) ?? null
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
  const target = isLiveMode.value ? 'video' : 'image'
  getFileInputElement(target)?.click()
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

      <AdminUploadPickerCard
        v-show="!hasSelection"
        v-model:upload-value="uploadValue"
        v-model:video-value="videoValue"
        :upload-mode="uploadMode"
        :set-file-upload-ref="setFileUploadRef"
        :set-video-upload-ref="setVideoUploadRef"
        @select-mode="setUploadMode"
      />

      <UForm
        v-if="hasSelection"
        :state="form"
        class="space-y-4"
        @submit.prevent="submit"
      >
        <AdminUploadEditorHeader
          :display-file-name="displayFileName"
          :preview-chips="previewChips"
          :submitting="submitting"
          :has-selected-file="Boolean(selectedFile)"
          @clear-selection="clearSelectedFile"
        />

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
            :submitting="submitting"
            @clear-selection="clearSelectedFile"
          />
        </div>
      </UForm>
    </UContainer>
  </div>
</template>
