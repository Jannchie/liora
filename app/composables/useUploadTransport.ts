import type { ComputedRef, Ref } from 'vue'
import type { MediaFormState } from '~/types/admin'
import { computed, ref } from 'vue'

interface PresignedUpload {
  key: string
  url: string
  method: 'PUT'
  headers: Record<string, string>
  publicUrl: string
}

interface PresignResponse {
  image: PresignedUpload
  video?: PresignedUpload
}

interface UploadMetrics {
  uploadProgress: Ref<number>
  uploadSpeed: Ref<number>
  uploadBytesSent: Ref<number>
  uploadTotalBytes: Ref<number>
  uploadStartedAt: Ref<number | null>
}

type RequestFetch = <T>(request: string, options?: {
  method?: string
  body?: unknown
  retry?: number
  params?: Record<string, string>
  [key: string]: unknown
}) => Promise<T>

function resolveContentType(file: File, fallback: string): string {
  if (file.type) {
    return file.type
  }
  const name = file.name.toLowerCase()
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) {
    return 'image/jpeg'
  }
  if (name.endsWith('.png')) {
    return 'image/png'
  }
  if (name.endsWith('.webp')) {
    return 'image/webp'
  }
  if (name.endsWith('.avif')) {
    return 'image/avif'
  }
  if (name.endsWith('.gif')) {
    return 'image/gif'
  }
  if (name.endsWith('.mov')) {
    return 'video/quicktime'
  }
  if (name.endsWith('.mp4')) {
    return 'video/mp4'
  }
  return fallback
}

function updateProgress(metrics: UploadMetrics, loaded: number, offset: number, total: number): void {
  metrics.uploadBytesSent.value = Math.min(total, offset + loaded)
  metrics.uploadProgress.value = total > 0 ? Math.min(100, (metrics.uploadBytesSent.value / total) * 100) : 0
  const startedAt = metrics.uploadStartedAt.value
  if (startedAt === null) {
    return
  }
  const elapsedSeconds = (performance.now() - startedAt) / 1000
  if (elapsedSeconds > 0) {
    metrics.uploadSpeed.value = metrics.uploadBytesSent.value / elapsedSeconds
  }
}

function uploadFileToPresignedUrl(
  file: File,
  presign: PresignedUpload,
  offset: number,
  total: number,
  metrics: UploadMetrics,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        updateProgress(metrics, event.loaded, offset, total)
      }
    })
    // eslint-disable-next-line unicorn/prefer-add-event-listener
    xhr.onerror = () => reject(new Error('Upload failed'))
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        updateProgress(metrics, file.size, offset, total)
        resolve()
      }
      else {
        reject(new Error(xhr.statusText || 'Upload failed'))
      }
    })
    xhr.open(presign.method, presign.url)
    for (const [header, value] of Object.entries(presign.headers)) {
      xhr.setRequestHeader(header, value)
    }
    xhr.send(file)
  })
}

async function requestPresignedUploads(
  requestFetch: RequestFetch,
  imageFile: File,
  videoFile: File | null,
): Promise<PresignResponse> {
  return requestFetch<PresignResponse>('/api/uploads/presign', {
    method: 'POST',
    body: {
      image: {
        filename: imageFile.name,
        contentType: resolveContentType(imageFile, 'image/jpeg'),
        size: imageFile.size,
      },
      video: videoFile
        ? {
            filename: videoFile.name,
            contentType: resolveContentType(videoFile, 'video/mp4'),
            size: videoFile.size,
          }
        : undefined,
    },
  })
}

export function useUploadTransport(): {
  uploadProgress: Ref<number>
  uploadSpeed: Ref<number>
  uploadBytesSent: Ref<number>
  uploadTotalBytes: Ref<number>
  uploadProgressPercent: ComputedRef<number>
  resetUploadMetrics: () => void
  sendFileWithProgress: (params: {
    imageFile: File
    videoFile: File | null
    form: MediaFormState
    isLiveMode: boolean
    liveFrameTime: number
    requestFetch: RequestFetch
  }) => Promise<{ uploadId?: string }>
} {
  const uploadProgress = ref(0)
  const uploadSpeed = ref(0)
  const uploadBytesSent = ref(0)
  const uploadTotalBytes = ref(0)
  const uploadStartedAt = ref<number | null>(null)
  const uploadProgressPercent = computed(() => Math.min(100, Math.max(0, uploadProgress.value)))

  const resetUploadMetrics = (): void => {
    uploadProgress.value = 0
    uploadSpeed.value = 0
    uploadBytesSent.value = 0
    uploadTotalBytes.value = 0
    uploadStartedAt.value = null
  }

  const sendFileWithProgress = async (params: {
    imageFile: File
    videoFile: File | null
    form: MediaFormState
    isLiveMode: boolean
    liveFrameTime: number
    requestFetch: RequestFetch
  }): Promise<{ uploadId?: string }> => {
    const { imageFile, videoFile, form, isLiveMode, liveFrameTime, requestFetch } = params
    uploadStartedAt.value = performance.now()
    uploadBytesSent.value = 0
    uploadTotalBytes.value = imageFile.size + (videoFile?.size ?? 0)
    uploadProgress.value = 0
    const totalBytes = uploadTotalBytes.value
    const metrics: UploadMetrics = {
      uploadProgress,
      uploadSpeed,
      uploadBytesSent,
      uploadTotalBytes,
      uploadStartedAt,
    }
    const presign = await requestPresignedUploads(requestFetch, imageFile, videoFile)

    let offset = 0
    await uploadFileToPresignedUrl(imageFile, presign.image, offset, totalBytes, metrics)
    offset += imageFile.size
    if (videoFile && presign.video) {
      await uploadFileToPresignedUrl(videoFile, presign.video, offset, totalBytes, metrics)
      offset += videoFile.size
    }

    updateProgress(metrics, totalBytes, 0, totalBytes)
    const response = await requestFetch<{ uploadId?: string }>('/api/files', {
      method: 'POST',
      body: {
        imageKey: presign.image.key,
        imageContentType: presign.image.headers['Content-Type'] ?? imageFile.type,
        videoKey: presign.video?.key,
        videoContentType: presign.video?.headers['Content-Type'] ?? videoFile?.type,
        originalName: imageFile.name,
        title: form.title,
        description: form.description,
        genre: form.genre,
        fanworkTitle: form.fanworkTitle,
        characters: form.characters,
        location: form.location,
        locationName: form.locationName,
        latitude: form.latitude,
        longitude: form.longitude,
        cameraModel: form.cameraModel,
        lensModel: form.lensModel,
        aperture: form.aperture,
        focalLength: form.focalLength,
        iso: form.iso,
        shutterSpeed: form.shutterSpeed,
        exposureBias: form.exposureBias,
        exposureProgram: form.exposureProgram,
        exposureMode: form.exposureMode,
        meteringMode: form.meteringMode,
        whiteBalance: form.whiteBalance,
        flash: form.flash,
        colorSpace: form.colorSpace,
        resolutionX: form.resolutionX,
        resolutionY: form.resolutionY,
        resolutionUnit: form.resolutionUnit,
        software: form.software,
        captureTime: form.captureTime,
        notes: form.notes,
        livePhotoStillTime: isLiveMode ? liveFrameTime : undefined,
      },
    })
    return { uploadId: response.uploadId }
  }

  return {
    uploadProgress,
    uploadSpeed,
    uploadBytesSent,
    uploadTotalBytes,
    uploadProgressPercent,
    resetUploadMetrics,
    sendFileWithProgress,
  }
}
