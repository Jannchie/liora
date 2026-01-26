import type { H3Event } from 'h3'
import type { S3Config } from '../utils/s3'
import type { UploadStatus } from '../utils/upload-status'
import type { FileMetadata } from '~/types/file'
import { createHash, randomUUID } from 'node:crypto'
import { basename, extname } from 'node:path'
import { eq } from 'drizzle-orm'
import sharp from 'sharp'
import { rgbaToThumbHash } from 'thumbhash'
import { requireAdmin } from '../utils/auth'
import { db, files } from '../utils/db'
import { joinCharacters } from '../utils/file-mapper'
import { computeHistogram } from '../utils/histogram'
import { buildPublicUrl, downloadObjectFromS3, headObjectFromS3, requireS3Config, uploadBufferToS3 } from '../utils/s3'
import { setUploadStatus } from '../utils/upload-status'

interface MultipartEntry {
  name: string
  filename?: string
  type?: string
  data: Buffer
}

interface ParsedForm {
  image: MultipartEntry
  video?: MultipartEntry
  fields: Record<string, string>
}

interface DirectUploadBody {
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
  notes?: string
  livePhotoStillTime?: number
}

const MAX_FILE_SIZE_BYTES = 60 * 1024 * 1024

const FORMAT_MIME_MAP: Record<string, string> = {
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  tiff: 'image/tiff',
  tif: 'image/tiff',
  gif: 'image/gif',
  svg: 'image/svg+xml',
}

const LENGTH_LIMITS = {
  title: { max: 256, label: 'Title' },
  description: { max: 4000, label: 'Description' },
  genre: { max: 120, label: 'Genre' },
  fanworkTitle: { max: 256, label: 'Fanwork title' },
  character: { max: 120, label: 'Character' },
  characterList: { max: 2000, label: 'Character list' },
  location: { max: 256, label: 'Location' },
  locationName: { max: 256, label: 'Location name' },
  cameraModel: { max: 256, label: 'Camera model' },
  lensModel: { max: 256, label: 'Lens model' },
  aperture: { max: 64, label: 'Aperture' },
  focalLength: { max: 64, label: 'Focal length' },
  iso: { max: 32, label: 'ISO' },
  shutterSpeed: { max: 64, label: 'Shutter speed' },
  exposureBias: { max: 64, label: 'Exposure bias' },
  exposureProgram: { max: 64, label: 'Exposure program' },
  exposureMode: { max: 64, label: 'Exposure mode' },
  meteringMode: { max: 64, label: 'Metering mode' },
  whiteBalance: { max: 64, label: 'White balance' },
  flash: { max: 64, label: 'Flash' },
  colorSpace: { max: 64, label: 'Color space' },
  resolutionX: { max: 32, label: 'Resolution X' },
  resolutionY: { max: 32, label: 'Resolution Y' },
  resolutionUnit: { max: 32, label: 'Resolution unit' },
  software: { max: 256, label: 'Software' },
  captureTime: { max: 128, label: 'Capture time' },
  notes: { max: 4000, label: 'Notes' },
  originalName: { max: 512, label: 'Original filename' },
} as const

async function computePerceptualHash(data: Buffer): Promise<string | null> {
  try {
    const { data: raw } = await sharp(data)
      .rotate()
      .resize(8, 8, { fit: 'cover' })
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true })

    const pixels = new Uint8Array(raw)
    const mean = pixels.reduce((sum, value) => sum + value, 0) / pixels.length
    let nibble = 0
    let hex = ''
    for (const [index, pixel] of pixels.entries()) {
      nibble = (nibble << 1) | (pixel > mean ? 1 : 0)
      if ((index + 1) % 4 === 0) {
        hex += nibble.toString(16)
        nibble = 0
      }
    }
    if (pixels.length % 4 !== 0) {
      nibble <<= 4 - (pixels.length % 4)
      hex += nibble.toString(16)
    }
    return hex.padStart(16, '0')
  }
  catch (error) {
    console.warn('Perceptual hash generation failed:', error)
    return null
  }
}

const normalizeText = (value: string | undefined): string => value?.trim() ?? ''

const computeSha256 = (data: Buffer): string => createHash('sha256').update(data).digest('hex')

function parseCharacters(raw: string | string[] | undefined): string[] {
  if (Array.isArray(raw)) {
    return raw.map(value => value.trim()).filter(value => value.length > 0)
  }
  return (raw ?? '')
    .split(/[,，\n]/)
    .map(value => value.trim())
    .filter(value => value.length > 0)
}

function buildMetadata(fields: Record<string, string>, characters: string[]): FileMetadata {
  const parsedStillTime = fields.livePhotoStillTime ? Number(fields.livePhotoStillTime) : Number.NaN
  const livePhotoStillTime = Number.isFinite(parsedStillTime) && parsedStillTime >= 0 ? parsedStillTime : undefined
  return {
    fanworkTitle: normalizeText(fields.fanworkTitle),
    characters,
    location: normalizeText(fields.location),
    locationName: normalizeText(fields.locationName),
    latitude: fields.latitude ? Number(fields.latitude) : null,
    longitude: fields.longitude ? Number(fields.longitude) : null,
    cameraModel: normalizeText(fields.cameraModel),
    lensModel: normalizeText(fields.lensModel),
    aperture: normalizeText(fields.aperture),
    focalLength: normalizeText(fields.focalLength),
    iso: normalizeText(fields.iso),
    shutterSpeed: normalizeText(fields.shutterSpeed),
    exposureBias: normalizeText(fields.exposureBias),
    exposureProgram: normalizeText(fields.exposureProgram),
    exposureMode: normalizeText(fields.exposureMode),
    meteringMode: normalizeText(fields.meteringMode),
    whiteBalance: normalizeText(fields.whiteBalance),
    flash: normalizeText(fields.flash),
    colorSpace: normalizeText(fields.colorSpace),
    resolutionX: normalizeText(fields.resolutionX),
    resolutionY: normalizeText(fields.resolutionY),
    resolutionUnit: normalizeText(fields.resolutionUnit),
    software: normalizeText(fields.software),
    captureTime: normalizeText(fields.captureTime),
    notes: normalizeText(fields.notes),
    fileSize: 0,
    thumbhash: undefined,
    perceptualHash: undefined,
    sha256: undefined,
    livePhotoStillTime,
  }
}

function resolveContentType(format: string | undefined, fallback: string | undefined): string | undefined {
  const normalized = format?.toLowerCase()
  if (normalized && FORMAT_MIME_MAP[normalized]) {
    return FORMAT_MIME_MAP[normalized]
  }
  const fallbackType = fallback?.trim()
  return fallbackType && fallbackType.length > 0 ? fallbackType : undefined
}

async function validateImage(file: MultipartEntry): Promise<{ width: number, height: number, contentType?: string }> {
  try {
    const metadata = await sharp(file.data).metadata()
    const width = metadata.width ?? 0
    const height = metadata.height ?? 0
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid image dimensions.' })
    }
    const contentType = resolveContentType(metadata.format, file.type)
    return { width, height, contentType }
  }
  catch (error) {
    console.warn('Image validation failed:', error)
    throw createError({ statusCode: 400, statusMessage: 'Invalid image file.' })
  }
}

function escapeRegExp(value: string): string {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\\$&`)
}

function stripLensFromCamera(cameraModel: string, lensModel: string): { cameraModel: string, lensModel: string } {
  const camera = cameraModel.trim()
  const lens = lensModel.trim()
  const separators = ['·', '|', '/']

  const tryExtractLens = (): { cameraModel: string, lensModel: string } => {
    if (lens.length > 0) {
      const pattern = new RegExp(String.raw`\s*[·|/,-]?\s*${escapeRegExp(lens)}`, 'gi')
      const cleaned = camera
        .replaceAll(pattern, '')
        .trim()
        .replace(/[·|/,-]+$/, '')
        .trim()
      return { cameraModel: cleaned.length > 0 ? cleaned : camera, lensModel: lens }
    }
    for (const separator of separators) {
      const index = camera.lastIndexOf(separator)
      if (index > 0 && index < camera.length - 2) {
        const base = camera.slice(0, index).trim()
        const extracted = camera.slice(index + 1).trim().replace(/^[·|/,-]+/, '').trim()
        if (base.length > 0 && extracted.length > 0) {
          return { cameraModel: base, lensModel: extracted }
        }
      }
    }
    const dashIndex = camera.lastIndexOf(' - ')
    if (dashIndex > 0 && dashIndex < camera.length - 3) {
      const base = camera.slice(0, dashIndex).trim()
      const extracted = camera.slice(dashIndex + 3).trim()
      if (base.length > 0 && extracted.length > 0) {
        return { cameraModel: base, lensModel: extracted }
      }
    }
    return { cameraModel: camera, lensModel: lens }
  }

  return tryExtractLens()
}

function assertLength(value: string, limit: number, label: string): void {
  if (value.length > limit) {
    throw createError({
      statusCode: 400,
      statusMessage: `${label} exceeds the maximum length of ${limit} characters.`,
    })
  }
}

function validateLengths(payload: {
  title: string
  description: string
  genre: string
  metadata: FileMetadata
  characters: string[]
  originalName: string
}): void {
  assertLength(payload.title, LENGTH_LIMITS.title.max, LENGTH_LIMITS.title.label)
  assertLength(payload.description, LENGTH_LIMITS.description.max, LENGTH_LIMITS.description.label)
  assertLength(payload.genre, LENGTH_LIMITS.genre.max, LENGTH_LIMITS.genre.label)
  assertLength(payload.metadata.fanworkTitle, LENGTH_LIMITS.fanworkTitle.max, LENGTH_LIMITS.fanworkTitle.label)
  assertLength(payload.metadata.location, LENGTH_LIMITS.location.max, LENGTH_LIMITS.location.label)
  assertLength(payload.metadata.locationName, LENGTH_LIMITS.locationName.max, LENGTH_LIMITS.locationName.label)
  assertLength(payload.metadata.cameraModel, LENGTH_LIMITS.cameraModel.max, LENGTH_LIMITS.cameraModel.label)
  assertLength(payload.metadata.lensModel, LENGTH_LIMITS.lensModel.max, LENGTH_LIMITS.lensModel.label)
  assertLength(payload.metadata.aperture, LENGTH_LIMITS.aperture.max, LENGTH_LIMITS.aperture.label)
  assertLength(payload.metadata.focalLength, LENGTH_LIMITS.focalLength.max, LENGTH_LIMITS.focalLength.label)
  assertLength(payload.metadata.iso, LENGTH_LIMITS.iso.max, LENGTH_LIMITS.iso.label)
  assertLength(payload.metadata.shutterSpeed, LENGTH_LIMITS.shutterSpeed.max, LENGTH_LIMITS.shutterSpeed.label)
  assertLength(payload.metadata.exposureBias, LENGTH_LIMITS.exposureBias.max, LENGTH_LIMITS.exposureBias.label)
  assertLength(payload.metadata.exposureProgram, LENGTH_LIMITS.exposureProgram.max, LENGTH_LIMITS.exposureProgram.label)
  assertLength(payload.metadata.exposureMode, LENGTH_LIMITS.exposureMode.max, LENGTH_LIMITS.exposureMode.label)
  assertLength(payload.metadata.meteringMode, LENGTH_LIMITS.meteringMode.max, LENGTH_LIMITS.meteringMode.label)
  assertLength(payload.metadata.whiteBalance, LENGTH_LIMITS.whiteBalance.max, LENGTH_LIMITS.whiteBalance.label)
  assertLength(payload.metadata.flash, LENGTH_LIMITS.flash.max, LENGTH_LIMITS.flash.label)
  assertLength(payload.metadata.colorSpace, LENGTH_LIMITS.colorSpace.max, LENGTH_LIMITS.colorSpace.label)
  assertLength(payload.metadata.resolutionX, LENGTH_LIMITS.resolutionX.max, LENGTH_LIMITS.resolutionX.label)
  assertLength(payload.metadata.resolutionY, LENGTH_LIMITS.resolutionY.max, LENGTH_LIMITS.resolutionY.label)
  assertLength(payload.metadata.resolutionUnit, LENGTH_LIMITS.resolutionUnit.max, LENGTH_LIMITS.resolutionUnit.label)
  assertLength(payload.metadata.software, LENGTH_LIMITS.software.max, LENGTH_LIMITS.software.label)
  assertLength(payload.metadata.captureTime, LENGTH_LIMITS.captureTime.max, LENGTH_LIMITS.captureTime.label)
  assertLength(payload.metadata.notes, LENGTH_LIMITS.notes.max, LENGTH_LIMITS.notes.label)
  assertLength(payload.originalName, LENGTH_LIMITS.originalName.max, LENGTH_LIMITS.originalName.label)

  for (const character of payload.characters) {
    assertLength(character, LENGTH_LIMITS.character.max, LENGTH_LIMITS.character.label)
  }
  const joinedCharacters = joinCharacters(payload.characters)
  assertLength(joinedCharacters, LENGTH_LIMITS.characterList.max, LENGTH_LIMITS.characterList.label)
}

function isMultipartRequest(event: H3Event): boolean {
  const contentType = event.node.req.headers['content-type'] ?? ''
  return contentType.includes('multipart/form-data')
}

async function parseMultipart(event: H3Event): Promise<ParsedForm> {
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

function parseDirectBody(body: DirectUploadBody | undefined): {
  imageKey: string
  imageContentType?: string
  videoKey?: string
  videoContentType?: string
  originalName: string
  fields: Record<string, string>
} {
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Request body is required.' })
  }
  const imageKey = assertKey(body.imageKey, 'imageKey')
  const videoKey = body.videoKey ? assertKey(body.videoKey, 'videoKey') : undefined
  const originalName = body.originalName?.trim() || basename(imageKey)
  const imageContentType = body.imageContentType?.trim() || undefined
  const videoContentType = body.videoContentType?.trim() || undefined
  const fields: Record<string, string> = {
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
    notes: toFieldString(body.notes),
    livePhotoStillTime: toFieldString(body.livePhotoStillTime),
  }
  return {
    imageKey,
    imageContentType,
    videoKey,
    videoContentType,
    originalName,
    fields,
  }
}

function normalizeExt(filename: string | undefined): string {
  const parsed = extname(filename ?? '').toLowerCase()
  if (parsed) {
    return parsed
  }
  return '.jpg'
}

function normalizeVideoExt(filename: string | undefined): string {
  const parsed = extname(filename ?? '').toLowerCase()
  if (parsed) {
    return parsed
  }
  return '.mp4'
}

function buildBaseName(filename: string | undefined): string {
  const ext = normalizeExt(filename)
  const raw = basename(filename ?? '', ext)
  const normalized = raw.normalize('NFKD').replaceAll(/[^\w-]+/g, '-').replaceAll(/-+/g, '-').replaceAll(/^-|-$/g, '')
  const limited = normalized.slice(0, 80)
  return limited.length > 0 ? limited : 'upload'
}

function buildVideoBaseName(filename: string | undefined): string {
  const ext = normalizeVideoExt(filename)
  const raw = basename(filename ?? '', ext)
  const normalized = raw.normalize('NFKD').replaceAll(/[^\w-]+/g, '-').replaceAll(/-+/g, '-').replaceAll(/^-|-$/g, '')
  const limited = normalized.slice(0, 80)
  return limited.length > 0 ? limited : 'live'
}

async function generateThumbhash(data: Buffer): Promise<string | null> {
  try {
    const pipeline = sharp(data).rotate()
    const metadata = await pipeline.metadata()
    const targetWidth = Math.min(100, metadata.width ?? 100)
    const targetHeight = Math.min(100, metadata.height ?? 100)

    const { data: raw, info } = await pipeline
      .resize(targetWidth, targetHeight, { fit: 'inside', withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })

    const hash = rgbaToThumbHash(info.width, info.height, new Uint8Array(raw))
    return Buffer.from(hash).toString('base64')
  }
  catch (error) {
    console.warn('Thumbhash generation failed:', error)
    return null
  }
}

async function saveFile(file: MultipartEntry, config: S3Config, contentType: string | undefined): Promise<{ imageUrl: string }> {
  const ext = normalizeExt(file.filename)
  const safeName = buildBaseName(file.filename)
  const baseName = `${safeName}-${Date.now().toString(36)}-${randomUUID()}`
  const originalKey = `${baseName}${ext}`

  const imageUrl = await uploadBufferToS3({
    key: originalKey,
    data: file.data,
    contentType,
    config,
  })

  return { imageUrl }
}

async function saveVideo(file: MultipartEntry, config: S3Config): Promise<{ videoUrl: string }> {
  const ext = normalizeVideoExt(file.filename)
  const safeName = buildVideoBaseName(file.filename)
  const baseName = `${safeName}-live-${Date.now().toString(36)}-${randomUUID()}`
  const originalKey = `${baseName}${ext}`
  const contentType = file.type?.trim() || 'video/mp4'

  const videoUrl = await uploadBufferToS3({
    key: originalKey,
    data: file.data,
    contentType,
    config,
  })

  return { videoUrl }
}

async function runMetadataPostProcessing(
  fileId: number,
  buffer: Buffer,
  baseMetadata: FileMetadata,
  uploadId: string,
): Promise<UploadStatus> {
  const nextMetadata: FileMetadata = { ...baseMetadata }
  let status: UploadStatus = 'completed'
  try {
    const [
      perceptualHash,
      histogram,
      thumbhash,
    ] = await Promise.all([
      computePerceptualHash(buffer),
      computeHistogram(buffer),
      generateThumbhash(buffer),
    ])
    if (perceptualHash) {
      nextMetadata.perceptualHash = perceptualHash
    }
    if (histogram) {
      nextMetadata.histogram = histogram
    }
    if (thumbhash) {
      nextMetadata.thumbhash = thumbhash
    }
  }
  catch (error) {
    status = 'failed'
    console.error('Post-upload metadata processing failed:', error)
  }

  nextMetadata.processingStatus = status
  nextMetadata.uploadId = uploadId

  try {
    await db
      .update(files)
      .set({ metadata: JSON.stringify(nextMetadata) })
      .where(eq(files.id, fileId))
  }
  catch (error) {
    status = 'failed'
    console.error('Post-upload metadata persistence failed:', error)
  }

  return status
}

interface MultipartUploadJobPayload {
  image: MultipartEntry
  video?: MultipartEntry
  fields: Record<string, string>
  storageConfig: S3Config
  uploadId: string
}

interface DirectUploadJobPayload {
  imageKey: string
  imageContentType?: string
  videoKey?: string
  videoContentType?: string
  originalName: string
  fields: Record<string, string>
  storageConfig: S3Config
  uploadId: string
}

async function processMultipartUpload(payload: MultipartUploadJobPayload): Promise<void> {
  const { image, video, fields, storageConfig, uploadId } = payload
  try {
    const { width, height, contentType } = await validateImage(image)
    const characters = parseCharacters(fields.characters)
    const metadata = buildMetadata(fields, characters)
    const deduped = stripLensFromCamera(metadata.cameraModel, metadata.lensModel)
    metadata.cameraModel = deduped.cameraModel
    metadata.lensModel = deduped.lensModel
    metadata.fileSize = image.data.length
    metadata.sha256 = computeSha256(image.data)
    metadata.processingStatus = 'processing'
    metadata.uploadId = uploadId
    const normalizedTitle = normalizeText(fields.title)
    const normalizedDescription = normalizeText(fields.description)
    const normalizedGenre = normalizeText(fields.genre)
    const originalName = image.filename ? basename(image.filename) : ''
    validateLengths({
      title: normalizedTitle,
      description: normalizedDescription,
      genre: normalizedGenre,
      metadata,
      characters,
      originalName,
    })
    const { imageUrl } = await saveFile(image, storageConfig, contentType)
    if (video) {
      const { videoUrl } = await saveVideo(video, storageConfig)
      metadata.livePhotoVideoUrl = videoUrl
    }

    const [created] = await db
      .insert(files)
      .values({
        title: normalizedTitle,
        description: normalizedDescription,
        originalName,
        imageUrl,
        width,
        height,
        fanworkTitle: metadata.fanworkTitle,
        characterList: joinCharacters(characters),
        location: metadata.location,
        locationName: metadata.locationName,
        latitude: metadata.latitude,
        longitude: metadata.longitude,
        cameraModel: metadata.cameraModel,
        aperture: metadata.aperture,
        focalLength: metadata.focalLength,
        iso: metadata.iso,
        shutterSpeed: metadata.shutterSpeed,
        captureTime: metadata.captureTime,
        metadata: JSON.stringify(metadata),
        genre: normalizedGenre,
      })
      .returning()

    if (!created) {
      throw new Error('Failed to create file record.')
    }

    const status = await runMetadataPostProcessing(created.id, image.data, metadata, uploadId)
    setUploadStatus(uploadId, status)
  }
  catch (error) {
    setUploadStatus(uploadId, 'failed')
    console.error('Async upload job failed:', error)
  }
}

async function processDirectUpload(payload: DirectUploadJobPayload): Promise<void> {
  const {
    imageKey,
    imageContentType,
    videoKey,
    originalName,
    fields,
    storageConfig,
    uploadId,
  } = payload
  try {
    const { buffer, contentType, contentLength } = await downloadObjectFromS3({
      key: imageKey,
      config: storageConfig,
    })
    if (contentLength && contentLength > MAX_FILE_SIZE_BYTES) {
      throw createError({
        statusCode: 413,
        statusMessage: `Image exceeds the maximum size of ${Math.floor(MAX_FILE_SIZE_BYTES / (1024 * 1024))}MB.`,
      })
    }
    if (buffer.length > MAX_FILE_SIZE_BYTES) {
      throw createError({
        statusCode: 413,
        statusMessage: `Image exceeds the maximum size of ${Math.floor(MAX_FILE_SIZE_BYTES / (1024 * 1024))}MB.`,
      })
    }
    const image: MultipartEntry = {
      name: 'image',
      filename: originalName,
      type: imageContentType ?? contentType,
      data: buffer,
    }
    const { width, height } = await validateImage(image)
    const characters = parseCharacters(fields.characters)
    const metadata = buildMetadata(fields, characters)
    const deduped = stripLensFromCamera(metadata.cameraModel, metadata.lensModel)
    metadata.cameraModel = deduped.cameraModel
    metadata.lensModel = deduped.lensModel
    metadata.fileSize = buffer.length
    metadata.sha256 = computeSha256(buffer)
    metadata.processingStatus = 'processing'
    metadata.uploadId = uploadId
    const normalizedTitle = normalizeText(fields.title)
    const normalizedDescription = normalizeText(fields.description)
    const normalizedGenre = normalizeText(fields.genre)
    validateLengths({
      title: normalizedTitle,
      description: normalizedDescription,
      genre: normalizedGenre,
      metadata,
      characters,
      originalName,
    })
    if (videoKey) {
      const { contentLength } = await headObjectFromS3({
        key: videoKey,
        config: storageConfig,
      })
      if (contentLength && contentLength > MAX_FILE_SIZE_BYTES) {
        throw createError({
          statusCode: 413,
          statusMessage: `Video exceeds the maximum size of ${Math.floor(MAX_FILE_SIZE_BYTES / (1024 * 1024))}MB.`,
        })
      }
    }
    const imageUrl = buildPublicUrl(storageConfig, imageKey)
    if (videoKey) {
      metadata.livePhotoVideoUrl = buildPublicUrl(storageConfig, videoKey)
    }

    const [created] = await db
      .insert(files)
      .values({
        title: normalizedTitle,
        description: normalizedDescription,
        originalName,
        imageUrl,
        width,
        height,
        fanworkTitle: metadata.fanworkTitle,
        characterList: joinCharacters(characters),
        location: metadata.location,
        locationName: metadata.locationName,
        latitude: metadata.latitude,
        longitude: metadata.longitude,
        cameraModel: metadata.cameraModel,
        aperture: metadata.aperture,
        focalLength: metadata.focalLength,
        iso: metadata.iso,
        shutterSpeed: metadata.shutterSpeed,
        captureTime: metadata.captureTime,
        metadata: JSON.stringify(metadata),
        genre: normalizedGenre,
      })
      .returning()

    if (!created) {
      throw new Error('Failed to create file record.')
    }

    const status = await runMetadataPostProcessing(created.id, buffer, metadata, uploadId)
    setUploadStatus(uploadId, status)
  }
  catch (error) {
    setUploadStatus(uploadId, 'failed')
    console.error('Async upload job failed:', error)
  }
}

function startBackgroundUpload(task: () => Promise<void>): void {
  setTimeout(() => {
    void task()
  }, 0)
}

export default defineEventHandler(async (event): Promise<{ accepted: true, uploadId: string }> => {
  requireAdmin(event)
  const storageConfig = requireS3Config(useRuntimeConfig(event).storage)
  let uploadId = ''

  if (isMultipartRequest(event)) {
    const { image, video, fields } = await parseMultipart(event)
    if (image.data.length > MAX_FILE_SIZE_BYTES) {
      throw createError({
        statusCode: 413,
        statusMessage: `Image exceeds the maximum size of ${Math.floor(MAX_FILE_SIZE_BYTES / (1024 * 1024))}MB.`,
      })
    }
    if (video && video.data.length > MAX_FILE_SIZE_BYTES) {
      throw createError({
        statusCode: 413,
        statusMessage: `Video exceeds the maximum size of ${Math.floor(MAX_FILE_SIZE_BYTES / (1024 * 1024))}MB.`,
      })
    }
    uploadId = randomUUID()
    setUploadStatus(uploadId, 'processing')
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
    uploadId = randomUUID()
    setUploadStatus(uploadId, 'processing')
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
