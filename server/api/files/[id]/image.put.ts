import type { H3Event } from 'h3'
import type { FileMetadata, FileResponse } from '~/types/file'
import { randomUUID } from 'node:crypto'
import { basename } from 'node:path'
import { eq } from 'drizzle-orm'
import { createError, readMultipartFormData } from 'h3'
import { computePerceptualHash, computeSha256, generateArthash, validateImage } from '../../../domain/files/image'
import { buildMetadata, mergeMetadataTextUpdates, normalizeMetadataTextUpdates, normalizeText, parseCharacters } from '../../../domain/files/metadata'
import { requireAdmin } from '../../../utils/auth'
import { db, files } from '../../../utils/db'
import { buildMetadataFallbacks, ensureMetadata, joinCharacters, mapCharacters, toFileResponse } from '../../../utils/file-mapper'
import { requireFileById } from '../../../utils/file-record'
import { extractFocusMetadataFromBuffer } from '../../../utils/focus-metadata'
import { computeHistogram } from '../../../utils/histogram'
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
  fields: Record<string, string>
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

function normalizeExt(filename: string | undefined): string {
  const ext = filename ? filename.slice(filename.lastIndexOf('.')) : ''
  if (!ext || ext.includes('/') || ext.includes('\\')) {
    return '.jpg'
  }
  return ext.toLowerCase()
}

async function saveFile(file: MultipartEntry, event: H3Event, contentType: string | undefined): Promise<{ imageUrl: string, arthash?: string }> {
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

  const arthash = await generateArthash(file.data) ?? undefined

  return { imageUrl, arthash }
}

export default defineEventHandler(async (event): Promise<FileResponse> => {
  requireAdmin(event)
  const id = requirePositiveIntRouterParam(event, 'id', 'Invalid file id.')
  const existing = await requireFileById(id)

  const { file, fields } = await parseMultipart(event)
  const { width, height, contentType, orientation } = await validateImage(file)
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
  const existingMetadata = ensureMetadata(existing.metadata, buildMetadataFallbacks(existing, existingCharacters, {
    fileSize: existingFileSize,
  }))
  const metadata = buildMetadata(fields, characters)
  const focusMetadata = await extractFocusMetadataFromBuffer(file.data, file.filename)
  metadata.focusDistance = focusMetadata.focusDistance ?? metadata.focusDistance
  metadata.focusFrameSize = focusMetadata.focusFrameSize ?? metadata.focusFrameSize
  metadata.focusLocation = focusMetadata.focusLocation ?? metadata.focusLocation
  metadata.focusMode = focusMetadata.focusMode ?? metadata.focusMode
  metadata.focusPosition = focusMetadata.focusPosition ?? metadata.focusPosition
  metadata.hasCrop = focusMetadata.hasCrop ?? metadata.hasCrop
  metadata.cropLeft = focusMetadata.cropLeft ?? metadata.cropLeft
  metadata.cropTop = focusMetadata.cropTop ?? metadata.cropTop
  metadata.cropRight = focusMetadata.cropRight ?? metadata.cropRight
  metadata.cropBottom = focusMetadata.cropBottom ?? metadata.cropBottom
  metadata.cropAngle = focusMetadata.cropAngle ?? metadata.cropAngle
  metadata.perspectiveHorizontal = focusMetadata.perspectiveHorizontal ?? metadata.perspectiveHorizontal
  metadata.perspectiveVertical = focusMetadata.perspectiveVertical ?? metadata.perspectiveVertical
  metadata.perspectiveRotate = focusMetadata.perspectiveRotate ?? metadata.perspectiveRotate
  metadata.perspectiveScale = focusMetadata.perspectiveScale ?? metadata.perspectiveScale
  metadata.perspectiveUpright = focusMetadata.perspectiveUpright ?? metadata.perspectiveUpright
  metadata.uprightTransform = focusMetadata.uprightTransform ?? metadata.uprightTransform
  metadata.lightroomRecipe = focusMetadata.lightroomRecipe ?? metadata.lightroomRecipe
  metadata.fileSize = file.data.length
  metadata.processingStatus = 'completed'

  metadata.perceptualHash = await computePerceptualHash(file.data) ?? undefined
  metadata.sha256 = computeSha256(file.data)

  const histogram = await computeHistogram(file.data)
  if (histogram) {
    metadata.histogram = histogram
  }

  const { imageUrl, arthash } = await saveFile(file, event, contentType)
  if (arthash) {
    metadata.arthash = arthash
  }

  const originalName = file.filename ? basename(file.filename) : existing.originalName
  const charactersToSave = metadata.characters.length > 0 ? metadata.characters : existingMetadata.characters
  const metadataBase: FileMetadata = {
    ...existingMetadata,
    // The image itself was replaced, so the new file's orientation applies
    // even when it is undefined (upright).
    orientation,
    characters: charactersToSave,
    latitude: Number.isFinite(metadata.latitude ?? null) ? metadata.latitude : existingMetadata.latitude,
    longitude: Number.isFinite(metadata.longitude ?? null) ? metadata.longitude : existingMetadata.longitude,
    fileSize: metadata.fileSize,
    arthash: metadata.arthash ?? existingMetadata.arthash,
    perceptualHash: metadata.perceptualHash ?? existingMetadata.perceptualHash,
    sha256: metadata.sha256 ?? existingMetadata.sha256,
    histogram: metadata.histogram ?? existingMetadata.histogram ?? null,
    processingStatus: metadata.processingStatus ?? existingMetadata.processingStatus ?? 'completed',
    uploadId: metadata.uploadId ?? existingMetadata.uploadId ?? '',
  }
  const metadataTextUpdates = normalizeMetadataTextUpdates(metadata)
  const mergedMetadata: FileMetadata = mergeMetadataTextUpdates(metadataBase, metadataTextUpdates, {
    preserveOnEmpty: true,
  })

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
