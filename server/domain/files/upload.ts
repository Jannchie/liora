import type { H3Event } from 'h3'
import { randomUUID } from 'node:crypto'
import { basename, extname } from 'node:path'
import { createError, readMultipartFormData } from 'h3'

export interface MultipartEntry {
  name: string
  filename?: string
  type?: string
  data: Buffer
}

export interface ParsedMultipartForm {
  image: MultipartEntry
  video?: MultipartEntry
  fields: Record<string, string>
}

export interface DirectUploadBody {
  imageKey?: string
  imageContentType?: string
  videoKey?: string
  videoContentType?: string
  originalName?: string
  title?: string
  description?: string
  genre?: string
  fanworkTitle?: string
  characters?: string[] | string
  location?: string
  locationName?: string
  latitude?: number | null
  longitude?: number | null
  cameraModel?: string
  lensModel?: string
  aperture?: string
  focalLength?: string
  iso?: string
  shutterSpeed?: string
  exposureBias?: string
  exposureProgram?: string
  exposureMode?: string
  meteringMode?: string
  whiteBalance?: string
  flash?: string
  colorSpace?: string
  resolutionX?: string
  resolutionY?: string
  resolutionUnit?: string
  software?: string
  captureTime?: string
  focusDistance?: string
  focusFrameSize?: string
  focusLocation?: string
  focusMode?: string
  focusPosition?: string
  hasCrop?: string
  cropLeft?: string
  cropTop?: string
  cropRight?: string
  cropBottom?: string
  cropAngle?: string
  perspectiveHorizontal?: string
  perspectiveVertical?: string
  perspectiveRotate?: string
  perspectiveScale?: string
  perspectiveUpright?: string
  uprightTransform?: string
  lightroomRecipe?: string
  llrRecipe?: string
  notes?: string
  livePhotoStillTime?: number
}

export interface ParsedDirectUpload {
  imageKey: string
  imageContentType?: string
  videoKey?: string
  videoContentType?: string
  originalName: string
  fields: Record<string, string>
}

export interface PresignFileInput {
  filename: string
  contentType: string
  size: number
}

export const MAX_FILE_SIZE_BYTES = 60 * 1024 * 1024

function normalizeImageExt(filename: string | undefined): string {
  const parsed = extname(filename ?? '').toLowerCase()
  return parsed || '.jpg'
}

function normalizeVideoExt(filename: string | undefined): string {
  const parsed = extname(filename ?? '').toLowerCase()
  return parsed || '.mp4'
}

function buildBaseName(filename: string | undefined, ext: string, fallback: string): string {
  const raw = basename(filename ?? '', ext)
  const normalized = raw.normalize('NFKD').replaceAll(/[^\w-]+/g, '-').replaceAll(/-+/g, '-').replaceAll(/^-|-$/g, '')
  const limited = normalized.slice(0, 80)
  return limited.length > 0 ? limited : fallback
}

export function buildImageKey(filename: string | undefined): string {
  const ext = normalizeImageExt(filename)
  const safeName = buildBaseName(filename, ext, 'upload')
  const baseName = `${safeName}-${Date.now().toString(36)}-${randomUUID()}`
  return `${baseName}${ext}`
}

export function buildVideoKey(filename: string | undefined): string {
  const ext = normalizeVideoExt(filename)
  const safeName = buildBaseName(filename, ext, 'live')
  const baseName = `${safeName}-live-${Date.now().toString(36)}-${randomUUID()}`
  return `${baseName}${ext}`
}

function assertKey(value: string | undefined, label: string): string {
  const trimmed = value?.trim() ?? ''
  if (!trimmed) {
    throw createError({ statusCode: 400, statusMessage: `${label} is required.` })
  }
  if (trimmed.includes('..') || trimmed.includes('\\') || trimmed.startsWith('/')) {
    throw createError({ statusCode: 400, statusMessage: `${label} is invalid.` })
  }
  return trimmed
}

function toFieldString(value: string | number | null | undefined): string {
  if (value === undefined || value === null) {
    return ''
  }
  return String(value)
}

function stringifyCharacters(value: string[] | string | undefined): string {
  if (Array.isArray(value)) {
    return value.join(', ')
  }
  return value ?? ''
}

export function parseDirectBody(body: DirectUploadBody | undefined): ParsedDirectUpload {
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Request body is required.' })
  }
  const imageKey = assertKey(body.imageKey, 'imageKey')
  const videoKey = body.videoKey ? assertKey(body.videoKey, 'videoKey') : undefined
  const originalName = body.originalName?.trim() || basename(imageKey)
  return {
    imageKey,
    imageContentType: body.imageContentType?.trim() || undefined,
    videoKey,
    videoContentType: body.videoContentType?.trim() || undefined,
    originalName,
    fields: {
      title: toFieldString(body.title),
      description: toFieldString(body.description),
      genre: toFieldString(body.genre),
      fanworkTitle: toFieldString(body.fanworkTitle),
      characters: stringifyCharacters(body.characters),
      location: toFieldString(body.location),
      locationName: toFieldString(body.locationName),
      latitude: toFieldString(body.latitude),
      longitude: toFieldString(body.longitude),
      cameraModel: toFieldString(body.cameraModel),
      lensModel: toFieldString(body.lensModel),
      aperture: toFieldString(body.aperture),
      focalLength: toFieldString(body.focalLength),
      iso: toFieldString(body.iso),
      shutterSpeed: toFieldString(body.shutterSpeed),
      exposureBias: toFieldString(body.exposureBias),
      exposureProgram: toFieldString(body.exposureProgram),
      exposureMode: toFieldString(body.exposureMode),
      meteringMode: toFieldString(body.meteringMode),
      whiteBalance: toFieldString(body.whiteBalance),
      flash: toFieldString(body.flash),
      colorSpace: toFieldString(body.colorSpace),
      resolutionX: toFieldString(body.resolutionX),
      resolutionY: toFieldString(body.resolutionY),
      resolutionUnit: toFieldString(body.resolutionUnit),
      software: toFieldString(body.software),
      captureTime: toFieldString(body.captureTime),
      focusDistance: toFieldString(body.focusDistance),
      focusFrameSize: toFieldString(body.focusFrameSize),
      focusLocation: toFieldString(body.focusLocation),
      focusMode: toFieldString(body.focusMode),
      focusPosition: toFieldString(body.focusPosition),
      hasCrop: toFieldString(body.hasCrop),
      cropLeft: toFieldString(body.cropLeft),
      cropTop: toFieldString(body.cropTop),
      cropRight: toFieldString(body.cropRight),
      cropBottom: toFieldString(body.cropBottom),
      cropAngle: toFieldString(body.cropAngle),
      perspectiveHorizontal: toFieldString(body.perspectiveHorizontal),
      perspectiveVertical: toFieldString(body.perspectiveVertical),
      perspectiveRotate: toFieldString(body.perspectiveRotate),
      perspectiveScale: toFieldString(body.perspectiveScale),
      perspectiveUpright: toFieldString(body.perspectiveUpright),
      uprightTransform: toFieldString(body.uprightTransform),
      lightroomRecipe: toFieldString(body.lightroomRecipe),
      llrRecipe: toFieldString(body.llrRecipe),
      notes: toFieldString(body.notes),
      livePhotoStillTime: toFieldString(body.livePhotoStillTime),
    },
  }
}

export function isMultipartRequest(event: H3Event): boolean {
  const contentType = event.node.req.headers['content-type'] ?? ''
  return contentType.includes('multipart/form-data')
}

export async function parseMultipart(event: H3Event): Promise<ParsedMultipartForm> {
  const form = await readMultipartFormData(event)
  if (!form) {
    throw createError({ statusCode: 400, statusMessage: 'Multipart form data is required.' })
  }

  let imageEntry: MultipartEntry | undefined
  let videoEntry: MultipartEntry | undefined
  const fields: Record<string, string> = {}

  for (const entry of form) {
    const fieldName = entry.name
    if (!fieldName) {
      continue
    }
    if (entry.filename) {
      const normalizedName = fieldName.trim().toLowerCase()
      const candidate = entry as MultipartEntry
      if (normalizedName === 'video' || normalizedName === 'livevideo') {
        if (!videoEntry) {
          videoEntry = candidate
        }
        continue
      }
      if (!imageEntry) {
        imageEntry = candidate
      }
    }
    else {
      fields[fieldName] = entry.data.toString('utf8')
    }
  }

  if (!imageEntry || !imageEntry.data?.length) {
    throw createError({ statusCode: 400, statusMessage: 'Image file is required.' })
  }
  if (videoEntry && !videoEntry.data?.length) {
    videoEntry = undefined
  }
  return { image: imageEntry, video: videoEntry, fields }
}

export function assertMaxFileSize(bytes: number, label: string): void {
  if (bytes <= MAX_FILE_SIZE_BYTES) {
    return
  }
  throw createError({
    statusCode: 413,
    statusMessage: `${label} exceeds the maximum size of ${Math.floor(MAX_FILE_SIZE_BYTES / (1024 * 1024))}MB.`,
  })
}

export function assertPresignFile(input: PresignFileInput, label: string): PresignFileInput {
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
  assertMaxFileSize(size, label)
  return { filename, contentType, size }
}

export function assertContentTypePrefix(value: string, prefix: string, label: string): void {
  if (value.startsWith(prefix)) {
    return
  }
  throw createError({ statusCode: 400, statusMessage: `${label} must be ${prefix}.*` })
}
