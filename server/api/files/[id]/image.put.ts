import type { H3Event } from 'h3'
import type { FileMetadata, FileResponse } from '~/types/file'
import { createHash, randomUUID } from 'node:crypto'
import { basename } from 'node:path'
import { eq } from 'drizzle-orm'
import { createError, getRouterParam, readMultipartFormData } from 'h3'
import sharp from 'sharp'
import { rgbaToThumbHash } from 'thumbhash'
import { requireAdmin } from '../../../utils/auth'
import { db, files } from '../../../utils/db'
import { ensureMetadata, joinCharacters, mapCharacters, toFileResponse } from '../../../utils/file-mapper'
import { computeHistogram } from '../../../utils/histogram'
import { requireS3Config, uploadBufferToS3 } from '../../../utils/s3'

interface MultipartEntry {
  name: string
  filename?: string
  type?: string
  data: Buffer
}

interface ParsedForm {
  file: MultipartEntry
  fields: Record<string, string>
}

interface ImageHashes {
  perceptualHash: string | null
  sha256: string
}

const normalizeText = (value: string | undefined): string => value?.trim() ?? ''
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

function parseId(event: H3Event): number {
  const idParam = getRouterParam(event, 'id')
  const id = Number(idParam)
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid file id.' })
  }
  return id
}

async function parseMultipart(event: H3Event): Promise<ParsedForm> {
  const form = await readMultipartFormData(event)
  if (!form) {
    throw createError({ statusCode: 400, statusMessage: 'Multipart form data is required.' })
  }

  let fileEntry: MultipartEntry | undefined
  const fields: Record<string, string> = {}

  for (const entry of form) {
    const name = entry.name?.trim()
    if (!name) {
      continue
    }
    if (entry.filename && (entry.data as Buffer | undefined)?.length) {
      if (!fileEntry) {
        fileEntry = {
          name,
          filename: entry.filename,
          type: entry.type,
          data: entry.data as Buffer,
        }
      }
      continue
    }
    const value = typeof entry.data === 'string' ? entry.data : entry.data?.toString('utf8') ?? ''
    fields[name] = value
  }

  if (!fileEntry) {
    throw createError({ statusCode: 400, statusMessage: 'Image file is required.' })
  }

  return { file: fileEntry, fields }
}

function parseCharacters(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(/[,，\n]/)
    .map(value => value.trim())
    .filter(value => value.length > 0)
}

function buildMetadata(fields: Record<string, string>, characters: string[]): FileMetadata {
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

function normalizeExt(filename: string | undefined): string {
  const ext = filename ? filename.slice(filename.lastIndexOf('.')) : ''
  if (!ext || ext.includes('/') || ext.includes('\\')) {
    return '.jpg'
  }
  return ext.toLowerCase()
}

async function generateThumbhash(buffer: Buffer): Promise<string | null> {
  try {
    const { data, info } = await sharp(buffer)
      .ensureAlpha()
      .resize(100, 100, { fit: 'inside' })
      .raw()
      .toBuffer({ resolveWithObject: true })

    const hash = rgbaToThumbHash(info.width, info.height, data)
    return Buffer.from(hash).toString('base64')
  }
  catch {
    return null
  }
}

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

async function computeHashes(data: Buffer): Promise<ImageHashes> {
  return {
    perceptualHash: await computePerceptualHash(data),
    sha256: createHash('sha256').update(data).digest('hex'),
  }
}

async function saveFile(file: MultipartEntry, event: H3Event, contentType: string | undefined): Promise<{ imageUrl: string, thumbhash?: string }> {
  const ext = normalizeExt(file.filename)
  const safeName = file.filename ? basename(file.filename).replace(/\.[^/.]+$/, '') : 'image'
  const baseName = `${safeName}-${Date.now().toString(36)}-${randomUUID()}`
  const originalKey = `${baseName}${ext}`
  const storageConfig = requireS3Config(useRuntimeConfig(event).storage)

  const imageUrl = await uploadBufferToS3({
    key: originalKey,
    data: file.data,
    contentType,
    config: storageConfig,
  })

  const thumbhash = await generateThumbhash(file.data) ?? undefined

  return { imageUrl, thumbhash }
}

export default defineEventHandler(async (event): Promise<FileResponse> => {
  requireAdmin(event)
  const id = parseId(event)
  const existing = await db.query.files.findFirst({
    where: eq(files.id, id),
  })
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'File not found.' })
  }

  const { file, fields } = await parseMultipart(event)
  const { width, height, contentType } = await validateImage(file)
  const characters = parseCharacters(fields.characters)
  const existingCharacters = mapCharacters(existing.characterList)
  const existingFileSize = (() => {
    try {
      const parsed = JSON.parse(existing.metadata) as Partial<FileMetadata>
      return Number.isFinite(parsed.fileSize) ? Number(parsed.fileSize) : 0
    }
    catch {
      return 0
    }
  })()
  const existingMetadata = ensureMetadata(existing.metadata, {
    fanworkTitle: existing.fanworkTitle,
    characters: existingCharacters,
    location: existing.location,
    locationName: existing.locationName,
    latitude: existing.latitude ?? null,
    longitude: existing.longitude ?? null,
    cameraModel: existing.cameraModel,
    lensModel: '',
    aperture: existing.aperture,
    focalLength: existing.focalLength,
    iso: existing.iso,
    shutterSpeed: existing.shutterSpeed,
    exposureBias: '',
    exposureProgram: '',
    exposureMode: '',
    meteringMode: '',
    whiteBalance: '',
    flash: '',
    colorSpace: '',
    resolutionX: '',
    resolutionY: '',
    resolutionUnit: '',
    software: '',
    captureTime: existing.captureTime,
    notes: '',
    thumbhash: undefined,
    perceptualHash: undefined,
    sha256: undefined,
    histogram: null,
    fileSize: existingFileSize,
    processingStatus: 'completed',
    uploadId: '',
  })
  const metadata = buildMetadata(fields, characters)
  metadata.fileSize = file.data.length
  metadata.processingStatus = 'completed'

  const hashes = await computeHashes(file.data)
  metadata.perceptualHash = hashes.perceptualHash ?? undefined
  metadata.sha256 = hashes.sha256

  const histogram = await computeHistogram(file.data)
  if (histogram) {
    metadata.histogram = histogram
  }

  const { imageUrl, thumbhash } = await saveFile(file, event, contentType)
  if (thumbhash) {
    metadata.thumbhash = thumbhash
  }

  const originalName = file.filename ? basename(file.filename) : existing.originalName
  const charactersToSave = metadata.characters.length > 0 ? metadata.characters : existingMetadata.characters
  const mergedMetadata: FileMetadata = {
    ...existingMetadata,
    fanworkTitle: normalizeText(fields.fanworkTitle) || existingMetadata.fanworkTitle,
    characters: charactersToSave,
    location: metadata.location || existingMetadata.location,
    locationName: metadata.locationName || existingMetadata.locationName,
    latitude: Number.isFinite(metadata.latitude ?? null) ? metadata.latitude : existingMetadata.latitude,
    longitude: Number.isFinite(metadata.longitude ?? null) ? metadata.longitude : existingMetadata.longitude,
    cameraModel: metadata.cameraModel || existingMetadata.cameraModel,
    lensModel: metadata.lensModel || existingMetadata.lensModel,
    aperture: metadata.aperture || existingMetadata.aperture,
    focalLength: metadata.focalLength || existingMetadata.focalLength,
    iso: metadata.iso || existingMetadata.iso,
    shutterSpeed: metadata.shutterSpeed || existingMetadata.shutterSpeed,
    exposureBias: metadata.exposureBias || existingMetadata.exposureBias,
    exposureProgram: metadata.exposureProgram || existingMetadata.exposureProgram,
    exposureMode: metadata.exposureMode || existingMetadata.exposureMode,
    meteringMode: metadata.meteringMode || existingMetadata.meteringMode,
    whiteBalance: metadata.whiteBalance || existingMetadata.whiteBalance,
    flash: metadata.flash || existingMetadata.flash,
    colorSpace: metadata.colorSpace || existingMetadata.colorSpace,
    resolutionX: metadata.resolutionX || existingMetadata.resolutionX,
    resolutionY: metadata.resolutionY || existingMetadata.resolutionY,
    resolutionUnit: metadata.resolutionUnit || existingMetadata.resolutionUnit,
    software: metadata.software || existingMetadata.software,
    captureTime: metadata.captureTime || existingMetadata.captureTime,
    notes: metadata.notes || existingMetadata.notes,
    fileSize: metadata.fileSize,
    thumbhash: metadata.thumbhash ?? existingMetadata.thumbhash,
    perceptualHash: metadata.perceptualHash ?? existingMetadata.perceptualHash,
    sha256: metadata.sha256 ?? existingMetadata.sha256,
    histogram: metadata.histogram ?? existingMetadata.histogram ?? null,
    processingStatus: metadata.processingStatus ?? existingMetadata.processingStatus ?? 'completed',
    uploadId: metadata.uploadId ?? existingMetadata.uploadId ?? '',
  }

  const [updated] = await db
    .update(files)
    .set({
      title: normalizeText(fields.title) || existing.title,
      description: normalizeText(fields.description) || existing.description,
      originalName,
      imageUrl,
      width,
      height,
      fanworkTitle: mergedMetadata.fanworkTitle,
      characterList: joinCharacters(charactersToSave.length > 0 ? charactersToSave : existingCharacters),
      location: mergedMetadata.location,
      locationName: mergedMetadata.locationName,
      latitude: mergedMetadata.latitude,
      longitude: mergedMetadata.longitude,
      cameraModel: mergedMetadata.cameraModel,
      aperture: mergedMetadata.aperture,
      focalLength: mergedMetadata.focalLength,
      iso: mergedMetadata.iso,
      shutterSpeed: mergedMetadata.shutterSpeed,
      captureTime: mergedMetadata.captureTime,
      metadata: JSON.stringify(mergedMetadata),
      genre: normalizeText(fields.genre) || existing.genre,
    })
    .where(eq(files.id, id))
    .returning()

  if (!updated) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to update file.' })
  }

  return toFileResponse(updated)
})
