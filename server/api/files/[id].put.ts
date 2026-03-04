import type { H3Event } from 'h3'
import type { FilePayload, FileResponse } from '~/types/file'
import { eq } from 'drizzle-orm'
import { createError, getRouterParam, readBody } from 'h3'
import { mergeMetadataTextUpdates, normalizeMetadataTextUpdates } from '../../domain/files/metadata'
import { requireAdmin } from '../../utils/auth'
import { db, files } from '../../utils/db'
import { buildMetadataFallbacks, ensureMetadata, joinCharacters, mapCharacters, toFileResponse } from '../../utils/file-mapper'
import replaceImageHandler from './[id]/image.put'

type UpdateBody = Partial<FilePayload>

function parseId(event: H3Event): number {
  const idParam = getRouterParam(event, 'id')
  const id = Number(idParam)
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid file id.' })
  }
  return id
}

function normalizeText(value: string | undefined, fallback: string): string {
  if (value === undefined) {
    return fallback
  }
  return value.trim()
}

function parsePositiveNumber(value: number | string | undefined, fallback: number, field: string): number {
  if (value === undefined) {
    return fallback
  }
  const parsed = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw createError({ statusCode: 400, statusMessage: `${field} must be a positive number.` })
  }
  return parsed
}

function parseNullableNumber(value: number | string | null | undefined, fallback: number | null, field: string): number | null {
  if (value === undefined) {
    return fallback
  }
  if (value === null) {
    return null
  }
  const parsed = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(parsed)) {
    throw createError({ statusCode: 400, statusMessage: `${field} must be a valid number.` })
  }
  return parsed
}

function normalizeCharacters(value: string | string[] | undefined, fallback: string[]): string[] {
  if (value === undefined) {
    return fallback
  }
  const list = Array.isArray(value) ? value : value.split(/[,，\n]/)
  return list
    .map(item => item.trim())
    .filter(item => item.length > 0)
}

function isMultipartRequest(event: H3Event): boolean {
  const contentType = event.node.req.headers['content-type'] ?? ''
  return contentType.includes('multipart/form-data')
}

export default defineEventHandler(async (event): Promise<FileResponse> => {
  if (isMultipartRequest(event)) {
    return replaceImageHandler(event)
  }
  requireAdmin(event)
  const id = parseId(event)
  const body = await readBody<UpdateBody>(event)

  const existing = await db.query.files.findFirst({
    where: eq(files.id, id),
  })
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'File not found.' })
  }

  const existingCharacters = mapCharacters(existing.characterList)
  const existingMetadata = ensureMetadata(existing.metadata, buildMetadataFallbacks(existing, existingCharacters))

  const title = normalizeText(body.title, existing.title)
  const description = normalizeText(body.description, existing.description)
  const width = parsePositiveNumber(body.width, existing.width, 'Width')
  const height = parsePositiveNumber(body.height, existing.height, 'Height')
  const characters = normalizeCharacters(body.characters, existingMetadata.characters)
  const genre = normalizeText(body.genre, existing.genre ?? '')

  const metadataBase = {
    ...existingMetadata,
    characters,
    latitude: parseNullableNumber(body.latitude, existingMetadata.latitude, 'Latitude'),
    longitude: parseNullableNumber(body.longitude, existingMetadata.longitude, 'Longitude'),
  }
  const metadataTextUpdates = normalizeMetadataTextUpdates(body)
  const mergedMetadata = mergeMetadataTextUpdates(metadataBase, metadataTextUpdates)

  const [updated] = await db
    .update(files)
    .set({
      title,
      description,
      width,
      height,
      fanworkTitle: mergedMetadata.fanworkTitle,
      characterList: joinCharacters(mergedMetadata.characters),
      genre,
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
    })
    .where(eq(files.id, id))
    .returning()

  if (!updated) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to update file.' })
  }

  return toFileResponse(updated)
})
