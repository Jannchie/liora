import type { H3Event } from 'h3'
import type { S3Config } from '../utils/s3'
import type { GenreClassificationResult } from '../utils/ai-classifier'
import type { FileMetadata, FileResponse } from '~/types/file'
import { createHash, randomUUID } from 'node:crypto'
import { basename, extname } from 'node:path'
import sharp from 'sharp'
import { rgbaToThumbHash } from 'thumbhash'
import { requireAdmin } from '../utils/auth'
import { classifyPhotoGenre } from '../utils/ai-classifier'
import { computeHistogram } from '../utils/histogram'
import { joinCharacters, toFileResponse } from '../utils/file-mapper'
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

const SIMILARITY_THRESHOLD = 6
const NIBBLE_BIT_COUNTS = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4]

interface ImageHashes {
  perceptualHash: string | null
  sha256: string
}

const deriveGenreLabel = (genre: GenreClassificationResult | null): string => {
  if (!genre) {
    return ''
  }
  if (genre.primary.trim().length > 0) {
    return genre.primary.trim()
  }
  if (genre.secondary.length > 0) {
    return genre.secondary[0]?.trim() ?? ''
  }
  return ''
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

function extractHashes(raw: string): { perceptualHash?: string, sha256?: string } {
  try {
    const parsed = JSON.parse(raw) as Partial<FileMetadata>
    return {
      perceptualHash: typeof parsed.perceptualHash === 'string' ? parsed.perceptualHash : undefined,
      sha256: typeof parsed.sha256 === 'string' ? parsed.sha256 : undefined,
    }
  }
  catch {
    return {}
  }
}

function hammingDistance(first: string, second: string): number | null {
  if (!first || !second || first.length !== second.length) {
    return null
  }
  let distance = 0
  for (const [index, element] of [...first].entries()) {
    const left = Number.parseInt(element, 16)
    const right = Number.parseInt(second[index] ?? '', 16)
    if (Number.isNaN(left) || Number.isNaN(right)) {
      return null
    }
    const diff = left ^ right
    if (diff < 0 || diff >= NIBBLE_BIT_COUNTS.length) {
      return null
    }
    const increment = NIBBLE_BIT_COUNTS[diff]
    if (increment === undefined) {
      return null
    }
    distance += increment
  }
  return distance
}

async function findSimilarFile(hashes: ImageHashes): Promise<{ id: number, title: string, distance: number } | null> {
  const existing = await prisma.file.findMany({ select: { id: true, title: true, metadata: true } })
  let closest: { id: number, title: string, distance: number } | null = null

  for (const file of existing) {
    const parsed = extractHashes(file.metadata)
    if (parsed.sha256 && parsed.sha256 === hashes.sha256) {
      return { id: file.id, title: file.title, distance: 0 }
    }
    if (!parsed.perceptualHash || !hashes.perceptualHash) {
      continue
    }
    const distance = hammingDistance(parsed.perceptualHash, hashes.perceptualHash)
    if (distance === null) {
      continue
    }
    if (distance <= SIMILARITY_THRESHOLD && (!closest || distance < closest.distance)) {
      closest = { id: file.id, title: file.title, distance }
    }
  }

  return closest
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
  const storageConfig = requireS3Config(useRuntimeConfig(event).storage)
  const { width, height } = parseNumbers(fields)

  const characters = parseCharacters(fields.characters)
  const metadata = buildMetadata(fields, characters)
  const deduped = stripLensFromCamera(metadata.cameraModel, metadata.lensModel)
  metadata.cameraModel = deduped.cameraModel
  metadata.lensModel = deduped.lensModel
  const hashes = await computeHashes(file.data)
  metadata.perceptualHash = hashes.perceptualHash ?? undefined
  metadata.sha256 = hashes.sha256

  const similar = await findSimilarFile(hashes)
  if (similar) {
    throw createError({
      statusCode: 409,
      statusMessage: `检测到相似图片，已存在记录 #${similar.id}${similar.distance > 0 ? `（距离 ${similar.distance}）` : ''}`,
      data: { existingId: similar.id, distance: similar.distance },
    })
  }

  const histogram = await computeHistogram(file.data)
  if (histogram) {
    metadata.histogram = histogram
  }
  const { imageUrl, thumbnailUrl, thumbhash } = await saveFile(file, storageConfig)
  if (thumbhash) {
    metadata.thumbhash = thumbhash
  }

  let genre: GenreClassificationResult | null = null
  try {
    genre = await classifyPhotoGenre(event, imageUrl)
  }
  catch (error) {
    console.warn('Photo genre classification failed:', error)
  }

  const originalName = file.filename ? basename(file.filename) : ''

  const created = await prisma.file.create({
    data: {
      title: normalizeText(fields.title),
      description: normalizeText(fields.description),
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
      genre: deriveGenreLabel(genre),
    },
  })

  return toFileResponse(created)
})
