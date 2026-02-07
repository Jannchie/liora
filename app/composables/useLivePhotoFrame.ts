import type { Ref } from 'vue'
import { computed, ref } from 'vue'

interface UseLivePhotoFrameOptions {
  videoValue: Ref<File | null>
  setUploadValue: (file: File | null) => void
  clearFormForNewFile: () => void
  onVideoError: () => void
  onFrameError: (message: string) => void
  frameFailedFallback: () => string
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

export function useLivePhotoFrame(options: UseLivePhotoFrameOptions): {
  videoPreviewUrl: Ref<string>
  liveFrameTime: Ref<number>
  liveFrameDuration: Ref<number>
  liveFramePending: Ref<boolean>
  videoElementRef: Ref<HTMLVideoElement | null>
  setVideoElementRef: (instance: unknown) => void
  liveFrameTimeLabel: Readonly<Ref<string>>
  liveFrameDurationLabel: Readonly<Ref<string>>
  clearVideoSelection: () => void
  handleVideoSelected: (file: File | null) => Promise<void>
  handleVideoMetadataLoaded: () => void
  handleVideoError: () => void
  handleFrameInput: (event: Event) => void
  captureLiveFrame: () => Promise<void>
} {
  const videoPreviewUrl = ref('')
  const liveFrameTime = ref(0)
  const liveFrameDuration = ref(0)
  const liveFramePending = ref(false)
  const videoElementRef = ref<HTMLVideoElement | null>(null)
  const liveFrameTimeLabel = computed(() => formatDuration(liveFrameTime.value))
  const liveFrameDurationLabel = computed(() => formatDuration(liveFrameDuration.value))
  const setVideoElementRef = (instance: unknown): void => {
    videoElementRef.value = instance instanceof HTMLVideoElement ? instance : null
  }

  const clearVideoSelection = (): void => {
    if (videoPreviewUrl.value) {
      URL.revokeObjectURL(videoPreviewUrl.value)
    }
    videoPreviewUrl.value = ''
    liveFrameDuration.value = 0
    liveFrameTime.value = 0
    liveFramePending.value = false
    options.videoValue.value = null
  }

  const normalizeFrameTime = (value: number): number => {
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

  const seekVideo = async (video: HTMLVideoElement, time: number): Promise<void> => {
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

  const captureLiveFrame = async (): Promise<void> => {
    const video = videoElementRef.value
    const selectedVideo = options.videoValue.value
    if (!video || !selectedVideo || liveFrameDuration.value <= 0) {
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
      const baseName = selectedVideo.name.replace(/\.[^/.]+$/, '') || 'live-photo'
      const frameFile = new File([blob], `${baseName}-frame.jpg`, { type: blob.type || 'image/jpeg' })
      options.setUploadValue(frameFile)
    }
    catch (error) {
      const message = error instanceof Error ? error.message : options.frameFailedFallback()
      options.onFrameError(message)
    }
    finally {
      liveFramePending.value = false
    }
  }

  const handleVideoSelected = async (file: File | null): Promise<void> => {
    liveFramePending.value = false
    if (!file) {
      options.setUploadValue(null)
      liveFrameDuration.value = 0
      liveFrameTime.value = 0
      if (videoPreviewUrl.value) {
        URL.revokeObjectURL(videoPreviewUrl.value)
      }
      videoPreviewUrl.value = ''
      return
    }
    options.clearFormForNewFile()
    options.setUploadValue(null)
    if (videoPreviewUrl.value) {
      URL.revokeObjectURL(videoPreviewUrl.value)
    }
    videoPreviewUrl.value = URL.createObjectURL(file)
    liveFrameDuration.value = 0
    liveFrameTime.value = 0
  }

  const handleVideoMetadataLoaded = (): void => {
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

  const handleVideoError = (): void => {
    options.onVideoError()
  }

  const handleFrameInput = (event: Event): void => {
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

  return {
    videoPreviewUrl,
    liveFrameTime,
    liveFrameDuration,
    liveFramePending,
    videoElementRef,
    setVideoElementRef,
    liveFrameTimeLabel,
    liveFrameDurationLabel,
    clearVideoSelection,
    handleVideoSelected,
    handleVideoMetadataLoaded,
    handleVideoError,
    handleFrameInput,
    captureLiveFrame,
  }
}
