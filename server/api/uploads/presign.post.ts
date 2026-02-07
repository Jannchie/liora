import type { PresignFileInput } from '../../domain/files/upload'
import { readBody } from 'h3'
import { assertContentTypePrefix, assertPresignFile, buildImageKey, buildVideoKey } from '../../domain/files/upload'
import { requireAdmin } from '../../utils/auth'
import { buildPublicUrl, createPresignedPutUrl, requireS3Config } from '../../utils/s3'

interface PresignRequest {
  image: PresignFileInput
  video?: PresignFileInput
}

interface PresignedFile {
  key: string
  url: string
  method: 'PUT'
  headers: Record<string, string>
  publicUrl: string
}

interface PresignResponse {
  image: PresignedFile
  video?: PresignedFile
}

export default defineEventHandler(async (event): Promise<PresignResponse> => {
  requireAdmin(event)

  const body = await readBody<PresignRequest>(event)
  const imageInput = assertPresignFile(body?.image as PresignFileInput, 'Image')
  assertContentTypePrefix(imageInput.contentType, 'image/', 'Image contentType')
  const videoInput = body?.video ? assertPresignFile(body.video as PresignFileInput, 'Video') : undefined
  if (videoInput) {
    assertContentTypePrefix(videoInput.contentType, 'video/', 'Video contentType')
  }

  const storageConfig = requireS3Config(useRuntimeConfig(event).storage)

  const imageKey = buildImageKey(imageInput.filename)
  const imagePresign = await createPresignedPutUrl({
    key: imageKey,
    contentType: imageInput.contentType,
    config: storageConfig,
  })
  const response: PresignResponse = {
    image: {
      key: imageKey,
      url: imagePresign.url,
      method: 'PUT',
      headers: imagePresign.headers,
      publicUrl: buildPublicUrl(storageConfig, imageKey),
    },
  }

  if (videoInput) {
    const videoKey = buildVideoKey(videoInput.filename)
    const videoPresign = await createPresignedPutUrl({
      key: videoKey,
      contentType: videoInput.contentType,
      config: storageConfig,
    })
    response.video = {
      key: videoKey,
      url: videoPresign.url,
      method: 'PUT',
      headers: videoPresign.headers,
      publicUrl: buildPublicUrl(storageConfig, videoKey),
    }
  }

  return response
})
