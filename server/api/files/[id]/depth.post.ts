import type { H3Event } from 'h3'
import type { FileMetadata } from '~/types/file'
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { createError, readMultipartFormData } from 'h3'
import sharp from 'sharp'
import { useRuntimeConfig } from '#imports'
import { requireAdmin } from '../../../utils/auth'
import { db, files } from '../../../utils/db'
import { buildMetadataFallbacks, ensureMetadata, mapCharacters } from '../../../utils/file-mapper'
import { requireFileById } from '../../../utils/file-record'
import { requirePositiveIntRouterParam } from '../../../utils/route-params'
import { requireS3Config, uploadBufferToS3 } from '../../../utils/s3'

interface MultipartEntry {
  name: string
  filename?: string
  type?: string
  data: Buffer
}

interface ParsedForm {
  file: MultipartEntry
}

interface DepthUploadResponse {
  depthMapUrl: string
  width: number
  height: number
}

const MAX_DEPTH_BYTES = 20 * 1024 * 1024
const DEPTH_SCALE_FACTOR = 0.25
const DEPTH_WEBP_QUALITY = 80
const DEPTH_STORAGE_CONTENT_TYPE = 'image/webp'
const DEPTH_STORAGE_EXTENSION = 'webp'
const ALLOWED_DEPTH_FORMATS = new Set(['png', 'webp'])

async function parseMultipart(event: H3Event): Promise<ParsedForm> {
  const form = await readMultipartFormData(event)
  if (!form) {
    throw createError({ statusCode: 400, statusMessage: 'Multipart form data is required.' })
  }

  let fileEntry: MultipartEntry | undefined
  for (const entry of form) {
    if (entry.filename && (entry.data as Buffer | undefined)?.length && !fileEntry) {
      fileEntry = {
        name: entry.name ?? 'depth',
        filename: entry.filename,
        type: entry.type,
        data: entry.data as Buffer,
      }
    }
  }

  if (!fileEntry) {
    throw createError({ statusCode: 400, statusMessage: 'Depth image is required.' })
  }

  return { file: fileEntry }
}

async function processDepthImage(
  file: MultipartEntry,
  originalWidth: number,
  originalHeight: number,
): Promise<{ buffer: Buffer, width: number, height: number }> {
  if (file.data.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Depth image is empty.' })
  }
  if (file.data.length > MAX_DEPTH_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Depth image is too large.' })
  }

  try {
    const metadata = await sharp(file.data).metadata()
    const width = metadata.width ?? 0
    const height = metadata.height ?? 0
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid depth image dimensions.' })
    }
    if (metadata.format && !ALLOWED_DEPTH_FORMATS.has(metadata.format)) {
      throw createError({ statusCode: 415, statusMessage: 'Depth image must be PNG or WebP.' })
    }
    const baseWidth = Number.isFinite(originalWidth) && originalWidth > 0 ? originalWidth : width
    const baseHeight = Number.isFinite(originalHeight) && originalHeight > 0 ? originalHeight : height
    const targetWidth = Math.max(1, Math.round(baseWidth * DEPTH_SCALE_FACTOR))
    const targetHeight = Math.max(1, Math.round(baseHeight * DEPTH_SCALE_FACTOR))
    const needsResize = width > targetWidth || height > targetHeight
    const pipeline = sharp(file.data)
    const finalPipeline = needsResize
      ? pipeline.resize({ width: targetWidth, height: targetHeight, fit: 'fill' })
      : pipeline
    const buffer = await finalPipeline.webp({ quality: DEPTH_WEBP_QUALITY, effort: 4 }).toBuffer()
    return {
      buffer,
      width: needsResize ? targetWidth : width,
      height: needsResize ? targetHeight : height,
    }
  }
  catch (error) {
    throw error instanceof Error
      ? error
      : createError({ statusCode: 400, statusMessage: 'Invalid depth image.' })
  }
}

function buildDepthKey(id: number): string {
  const timestamp = Date.now().toString(36)
  const suffix = randomUUID()
  return `depth/${id}/depth-${timestamp}-${suffix}.${DEPTH_STORAGE_EXTENSION}`
}

export default defineEventHandler(async (event): Promise<DepthUploadResponse> => {
  requireAdmin(event)

  const id = requirePositiveIntRouterParam(event, 'id', 'Invalid file id.')
  const existing = await requireFileById(id)

  const { file } = await parseMultipart(event)
  const { buffer, width, height } = await processDepthImage(file, existing.width, existing.height)
  const storageConfig = requireS3Config(useRuntimeConfig(event).storage)
  const depthMapUrl = await uploadBufferToS3({
    key: buildDepthKey(id),
    data: buffer,
    contentType: DEPTH_STORAGE_CONTENT_TYPE,
    config: storageConfig,
  })

  const characters = mapCharacters(existing.characterList)
  const existingMetadata = ensureMetadata(existing.metadata, buildMetadataFallbacks(existing, characters))

  const mergedMetadata: FileMetadata = {
    ...existingMetadata,
    depthMapUrl,
    depthMapWidth: width,
    depthMapHeight: height,
  }

  await db
    .update(files)
    .set({ metadata: JSON.stringify(mergedMetadata) })
    .where(eq(files.id, id))

  return {
    depthMapUrl,
    width,
    height,
  }
})
