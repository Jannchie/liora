import type { H3Event } from 'h3'
import type { S3Config } from '../utils/s3'
import type { FileMetadata, FileResponse } from '~/types/file'
import { createHash, randomUUID } from 'node:crypto'
import { basename, extname } from 'node:path'
import sharp from 'sharp'
import { rgbaToThumbHash } from 'thumbhash'
import { requireAdmin } from '../utils/auth'
import { joinCharacters, toFileResponse } from '../utils/file-mapper'
import { computeHistogram } from '../utils/histogram'
import { prisma } from '../utils/prisma'
import { requireS3Config, uploadBufferToS3 } from '../utils/s3'

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

const MAX_FILE_SIZE_BYTES = 60 * 1024 * 1024

interface ImageHashes {
  perceptualHash: string | null
  sha256: string
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

async function computeHashes(data: Buffer): Promise<ImageHashes> {
  return {
    perceptualHash: await computePerceptualHash(data),
    sha256: createHash('sha256').update(data).digest('hex'),
  }
}

const normalizeText = (value: string | undefined): string => value?.trim() ?? ''

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

function parseNumbers(fields: Record<string, string>): { width: number, height: number } {
  const width = Number(fields.width)
  const height = Number(fields.height)

  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Width and height are required.' })
  }

  return { width, height }
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
      const pattern = new RegExp(`\\s*[·|/,-]?\\s*${escapeRegExp(lens)}`, 'gi')
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

async function parseMultipart(event: H3Event): Promise<ParsedForm> {
  const form = await readMultipartFormData(event)
  if (!form) {
    throw createError({ statusCode: 400, statusMessage: 'Multipart form data is required.' })
  }

  let fileEntry: MultipartEntry | undefined
  const fields: Record<string, string> = {}

  for (const entry of form) {
    const fieldName = entry.name
    if (!fieldName) {
      continue
    }
    if (entry.filename) {
      if (!fileEntry) {
        fileEntry = entry as MultipartEntry
      }
    }
    else {
      fields[fieldName] = entry.data.toString('utf8')
    }
  }

  if (!fileEntry || !fileEntry.data?.length) {
    throw createError({ statusCode: 400, statusMessage: 'Image file is required.' })
  }

  return { file: fileEntry, fields }
}

function normalizeExt(filename: string | undefined): string {
  const parsed = extname(filename ?? '').toLowerCase()
  if (parsed) {
    return parsed
  }
  return '.jpg'
}

function buildBaseName(filename: string | undefined): string {
  const ext = normalizeExt(filename)
  const raw = basename(filename ?? '', ext)
  const normalized = raw.normalize('NFKD').replaceAll(/[^\w-]+/g, '-').replaceAll(/-+/g, '-').replaceAll(/^-|-$/g, '')
  const limited = normalized.slice(0, 80)
  return limited.length > 0 ? limited : 'upload'
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

async function saveFile(file: MultipartEntry, config: S3Config): Promise<{ imageUrl: string, thumbnailUrl: string, thumbhash?: string }> {
  const ext = normalizeExt(file.filename)
  const safeName = buildBaseName(file.filename)
  const baseName = `${safeName}-${Date.now().toString(36)}-${randomUUID()}`
  const originalKey = `${baseName}${ext}`

  const imageUrl = await uploadBufferToS3({
    key: originalKey,
    data: file.data,
    contentType: file.type,
    config,
  })

  const thumbhash = await generateThumbhash(file.data) ?? undefined
  const thumbnailUrl = imageUrl

  return { imageUrl, thumbnailUrl, thumbhash }
}

export default defineEventHandler(async (event): Promise<FileResponse> => {
  requireAdmin(event)
  const { file, fields } = await parseMultipart(event)
  if (file.data.length > MAX_FILE_SIZE_BYTES) {
    throw createError({
      statusCode: 413,
      statusMessage: `File exceeds the maximum size of ${Math.floor(MAX_FILE_SIZE_BYTES / (1024 * 1024))}MB.`,
    })
  }
  const storageConfig = requireS3Config(useRuntimeConfig(event).storage)
  const { width, height } = parseNumbers(fields)

  const characters = parseCharacters(fields.characters)
  const metadata = buildMetadata(fields, characters)
  const deduped = stripLensFromCamera(metadata.cameraModel, metadata.lensModel)
  metadata.cameraModel = deduped.cameraModel
  metadata.lensModel = deduped.lensModel
  metadata.fileSize = file.data.length
  const normalizedTitle = normalizeText(fields.title)
  const normalizedDescription = normalizeText(fields.description)
  const normalizedGenre = normalizeText(fields.genre)
  const originalName = file.filename ? basename(file.filename) : ''
  validateLengths({
    title: normalizedTitle,
    description: normalizedDescription,
    genre: normalizedGenre,
    metadata,
    characters,
    originalName,
  })
  const hashes = await computeHashes(file.data)
  metadata.perceptualHash = hashes.perceptualHash ?? undefined
  metadata.sha256 = hashes.sha256

  const histogram = await computeHistogram(file.data)
  if (histogram) {
    metadata.histogram = histogram
  }
  const { imageUrl, thumbnailUrl, thumbhash } = await saveFile(file, storageConfig)
  if (thumbhash) {
    metadata.thumbhash = thumbhash
  }

  const created = await prisma.file.create({
    data: {
      title: normalizedTitle,
      description: normalizedDescription,
      originalName,
      imageUrl,
      thumbnailUrl,
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
    },
  })

  return toFileResponse(created)
})
