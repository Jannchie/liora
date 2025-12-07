export type UploadStatus = 'processing' | 'completed' | 'failed'

const statusStore = new Map<string, UploadStatus>()

export function setUploadStatus(uploadId: string, status: UploadStatus): void {
  statusStore.set(uploadId, status)
}

export function getUploadStatus(uploadId: string): UploadStatus | undefined {
  return statusStore.get(uploadId)
}
