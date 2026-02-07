import type { DirectUploadBody } from '../domain/files/upload'
import { randomUUID } from 'node:crypto'
import { readBody } from 'h3'
import { processDirectUpload, processMultipartUpload, startBackgroundUpload } from '../domain/files/service'
import {
  assertMaxFileSize,
  isMultipartRequest,
  parseDirectBody,
  parseMultipart,
} from '../domain/files/upload'
import { requireAdmin } from '../utils/auth'
import { requireS3Config } from '../utils/s3'
import { setUploadStatus } from '../utils/upload-status'

export default defineEventHandler(async (event): Promise<{ accepted: true, uploadId: string }> => {
  requireAdmin(event)
  const storageConfig = requireS3Config(useRuntimeConfig(event).storage)
  const uploadId = randomUUID()
  setUploadStatus(uploadId, 'processing')

  if (isMultipartRequest(event)) {
    const { image, video, fields } = await parseMultipart(event)
    assertMaxFileSize(image.data.length, 'Image')
    if (video) {
      assertMaxFileSize(video.data.length, 'Video')
    }
    startBackgroundUpload(() => processMultipartUpload({
      image,
      video,
      fields,
      storageConfig,
      uploadId,
    }))
  }
  else {
    const body = await readBody<DirectUploadBody>(event)
    const parsed = parseDirectBody(body)
    startBackgroundUpload(() => processDirectUpload({
      imageKey: parsed.imageKey,
      imageContentType: parsed.imageContentType,
      videoKey: parsed.videoKey,
      videoContentType: parsed.videoContentType,
      originalName: parsed.originalName,
      fields: parsed.fields,
      storageConfig,
      uploadId,
    }))
  }

  event.node.res.statusCode = 202
  return { accepted: true, uploadId }
})
