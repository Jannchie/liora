import type { BatchUploadPayload, BatchUploadResult, UploadProcessingStatus } from '~/types/file'
import { randomUUID } from 'node:crypto'
import { basename } from 'node:path'
import { readBody } from 'h3'
import { parseBatchUploadPayload, pickMaskedChanges } from '../../domain/files/batch'
import { processDirectUpload } from '../../domain/files/service'
import { parseDirectBody } from '../../domain/files/upload'
import { requireAdmin } from '../../utils/auth'
import { requireS3Config } from '../../utils/s3'
import { getUploadStatus, setUploadStatus } from '../../utils/upload-status'

function resolveOriginalName(imageKey: string, originalName?: string): string {
  if (originalName && originalName.trim().length > 0) {
    return originalName.trim()
  }
  return basename(imageKey)
}

function toStatus(value: UploadProcessingStatus | undefined): UploadProcessingStatus | 'unknown' {
  if (value === 'processing' || value === 'completed' || value === 'failed') {
    return value
  }
  return 'unknown'
}

export default defineEventHandler(async (event): Promise<BatchUploadResult> => {
  requireAdmin(event)

  const body = await readBody<BatchUploadPayload>(event)
  const parsed = parseBatchUploadPayload(body)
  const shared = pickMaskedChanges(parsed.sharedChanges, parsed.fieldMask)
  const storageConfig = requireS3Config(useRuntimeConfig(event).storage)

  const items: BatchUploadResult['items'] = []

  for (const [index, item] of parsed.items.entries()) {
    const uploadId = randomUUID()
    setUploadStatus(uploadId, 'processing')

    const mergedChanges = {
      ...shared,
      ...item.metadataOverrides,
    }

    const directBody = parseDirectBody({
      imageKey: item.imageKey,
      imageContentType: item.imageContentType,
      originalName: resolveOriginalName(item.imageKey, item.originalName),
      ...mergedChanges,
    })

    await processDirectUpload({
      imageKey: directBody.imageKey,
      imageContentType: directBody.imageContentType,
      originalName: directBody.originalName,
      videoKey: directBody.videoKey,
      videoContentType: directBody.videoContentType,
      fields: directBody.fields,
      storageConfig,
      uploadId,
    })

    items.push({
      index,
      originalName: directBody.originalName,
      uploadId,
      status: toStatus(getUploadStatus(uploadId)),
    })
  }

  const success = items.filter(item => item.status === 'completed').length
  const failed = items.length - success

  return {
    total: items.length,
    success,
    failed,
    items,
  }
})
