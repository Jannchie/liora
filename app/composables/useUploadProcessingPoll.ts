import type { UploadProcessingStatus } from '~/types/file'
import { ref } from 'vue'

interface ToastMessages {
  processing: string
  processingDescription: string
  processingDoneTitle: string
  processingDoneDescription: string
  processingFailedTitle: string
  processingFailedDescription: string
}

type RequestFetch = <T>(request: string, options?: {
  params?: Record<string, string>
  retry?: number
  [key: string]: unknown
}) => Promise<T>

interface ToastOptions {
  title: string
  description?: string
  color?: string
  duration?: number
  id?: string | number
}

interface ToastApi {
  add: (options: ToastOptions) => unknown
}

export function useUploadProcessingPoll(toast: ToastApi): {
  startProcessingStatusPoll: (uploadId: string, requestFetch: RequestFetch, messages: ToastMessages) => void
  stopProcessingStatusPoll: () => void
} {
  const processingToastId = ref<string | null>(null)
  const processingPollTimer = ref<ReturnType<typeof setInterval> | null>(null)

  const stopProcessingStatusPoll = (): void => {
    if (processingPollTimer.value !== null) {
      clearInterval(processingPollTimer.value)
      processingPollTimer.value = null
    }
  }

  const pushProcessingToast = (status: UploadProcessingStatus | 'unknown', messages: ToastMessages): void => {
    if (!processingToastId.value) {
      return
    }
    if (status === 'processing') {
      toast.add({
        id: processingToastId.value,
        title: messages.processing,
        description: messages.processingDescription,
        color: 'primary',
        duration: Number.POSITIVE_INFINITY,
      })
      return
    }
    if (status === 'completed') {
      toast.add({
        id: processingToastId.value,
        title: messages.processingDoneTitle,
        description: messages.processingDoneDescription,
        color: 'success',
      })
      return
    }
    toast.add({
      id: processingToastId.value,
      title: messages.processingFailedTitle,
      description: messages.processingFailedDescription,
      color: 'error',
    })
  }

  const startProcessingStatusPoll = (uploadId: string, requestFetch: RequestFetch, messages: ToastMessages): void => {
    stopProcessingStatusPoll()
    processingToastId.value = `upload-processing-${uploadId}`
    pushProcessingToast('processing', messages)
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
            pushProcessingToast('failed', messages)
            stopProcessingStatusPoll()
          }
          return
        }
        pushProcessingToast(response.status, messages)
        stopProcessingStatusPoll()
      }
      catch {
        if (attempts >= maxAttempts) {
          pushProcessingToast('failed', messages)
          stopProcessingStatusPoll()
        }
      }
    }
    void poll()
    processingPollTimer.value = setInterval(() => {
      void poll()
    }, 2000)
  }

  return {
    startProcessingStatusPoll,
    stopProcessingStatusPoll,
  }
}
