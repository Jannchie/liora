import type { UploadStatus } from '../../utils/upload-status'
import type { FileMetadata } from '~/types/file'
import { requireAdmin } from '../../utils/auth'
import { db, files } from '../../utils/db'
import { getUploadStatus, setUploadStatus } from '../../utils/upload-status'

function parseMetadata(raw: string): Partial<FileMetadata> {
  try {
    return JSON.parse(raw) as Partial<FileMetadata>
  }
  catch {
    return {}
  }
}

export default defineEventHandler(async (event): Promise<{ status: UploadStatus | 'unknown' }> => {
  requireAdmin(event)
  const query = getQuery(event)
  const uploadId = typeof query.uploadId === 'string' ? query.uploadId.trim() : ''
  if (!uploadId) {
    throw createError({ statusCode: 400, statusMessage: 'uploadId is required' })
  }

  const status = getUploadStatus(uploadId)
  if (status) {
    return { status }
  }

  const rows = await db.select({ metadata: files.metadata }).from(files)
  for (const row of rows) {
    const metadata = parseMetadata(row.metadata)
    if (metadata.uploadId === uploadId) {
      const persistedStatus: UploadStatus = metadata.processingStatus ?? 'completed'
      setUploadStatus(uploadId, persistedStatus)
      return { status: persistedStatus }
    }
  }

  return { status: 'unknown' }
})
