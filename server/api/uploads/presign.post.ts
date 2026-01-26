import { randomUUID } from 'node:crypto'
import { basename, extname } from 'node:path'
import { createError, readBody } from 'h3'
import { requireAdmin } from '../../utils/auth'
import { buildPublicUrl, createPresignedPutUrl, requireS3Config } from '../../utils/s3'

interface PresignFileInput {
  filename: string
  contentType: string
  size: number
}

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

const MAX_FILE_SIZE_BYTES = 60 * 1024 * 1024

function assertFile(input: PresignFileInput, label: string): PresignFileInput {
  if (!input || typeof input !== 'object') {
    throw createError({ statusCode: 400, statusMessage: `${label} is required.` })
  }
  const filename = input.filename?.trim() ?? ''
  const contentType = input.contentType?.trim().toLowerCase() ?? ''
  const size = input.size
  if (!filename) {
    throw createError({ statusCode: 400, statusMessage: `${label} filename is required.` })
  }
  if (!contentType) {
    throw createError({ statusCode: 400, statusMessage: `${label} contentType is required.` })
  }
  if (!Number.isFinite(size) || size <= 0) {
    throw createError({ statusCode: 400, statusMessage: `${label} size is invalid.` })
  }
  if (size > MAX_FILE_SIZE_BYTES) {
    throw createError({
      statusCode: 413,
      statusMessage: `${label} exceeds the maximum size of ${Math.floor(MAX_FILE_SIZE_BYTES / (1024 * 1024))}MB.`,
    })
  }
  return { filename, contentType, size }
}

function normalizeExt(filename: string): string {
  const parsed = extname(filename).toLowerCase()
  return parsed || '.jpg'
}

function normalizeVideoExt(filename: string): string {
  const parsed = extname(filename).toLowerCase()
  return parsed || '.mp4'
}

function buildBaseName(filename: string, ext: string): string {
  const raw = basename(filename, ext)
  const normalized = raw.normalize('NFKD').replaceAll(/[^\w-]+/g, '-').replaceAll(/-+/g, '-').replaceAll(/^-|-$/g, '')
  const limited = normalized.slice(0, 80)
  return limited.length > 0 ? limited : 'upload'
}

function buildVideoBaseName(filename: string, ext: string): string {
  const raw = basename(filename, ext)
  const normalized = raw.normalize('NFKD').replaceAll(/[^\w-]+/g, '-').replaceAll(/-+/g, '-').replaceAll(/^-|-$/g, '')
  const limited = normalized.slice(0, 80)
  return limited.length > 0 ? limited : 'live'
}

function buildImageKey(filename: string): string {
  const ext = normalizeExt(filename)
  const safeName = buildBaseName(filename, ext)
  const baseName = `${safeName}-${Date.now().toString(36)}-${randomUUID()}`
  return `${baseName}${ext}`
}

function buildVideoKey(filename: string): string {
  const ext = normalizeVideoExt(filename)
  const safeName = buildVideoBaseName(filename, ext)
  const baseName = `${safeName}-live-${Date.now().toString(36)}-${randomUUID()}`
  return `${baseName}${ext}`
}

function assertContentType(value: string, prefix: string, label: string): void {
  if (!value.startsWith(prefix)) {
    throw createError({ statusCode: 400, statusMessage: `${label} must be ${prefix}.*` })
  }
}

export default defineEventHandler(async (event): Promise<PresignResponse> => {
  requireAdmin(event)

  const body = await readBody<PresignRequest>(event)
  const imageInput = assertFile(body?.image as PresignFileInput, 'Image')
  assertContentType(imageInput.contentType, 'image/', 'Image contentType')
  const videoInput = body?.video ? assertFile(body.video as PresignFileInput, 'Video') : undefined
  if (videoInput) {
    assertContentType(videoInput.contentType, 'video/', 'Video contentType')
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
