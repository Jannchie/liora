import type { H3Event } from 'h3'
import type { FilePayload, FileResponse } from '~/types/file'
import { eq } from 'drizzle-orm'
import { createError, readBody } from 'h3'
import {
  normalizeOptionalCharacters,
  normalizeOptionalText,
  parseOptionalNullableNumber,
  parseOptionalPositiveNumber,
} from '../../domain/files/field-parsers'
import { mergeMetadataTextUpdates, normalizeMetadataTextUpdates } from '../../domain/files/metadata'
import { requireAdmin } from '../../utils/auth'
import { db, files } from '../../utils/db'
import { buildMetadataFallbacks, ensureMetadata, joinCharacters, mapCharacters, toFileResponse } from '../../utils/file-mapper'
import { requireFileById } from '../../utils/file-record'
import { requirePositiveIntRouterParam } from '../../utils/route-params'
import replaceImageHandler from './[id]/image.put'

type UpdateBody = Partial<FilePayload>

function isMultipartRequest(event: H3Event): boolean {
  const contentType = event.node.req.headers['content-type'] ?? ''
  return contentType.includes('multipart/form-data')
}

export default defineEventHandler(async (event): Promise<FileResponse> => {
  if (isMultipartRequest(event)) {
    return replaceImageHandler(event)
  }
  requireAdmin(event)
  const id = requirePositiveIntRouterParam(event, 'id', 'Invalid file id.')
  const body = await readBody<UpdateBody>(event)
  const existing = await requireFileById(id)

  const existingCharacters = mapCharacters(existing.characterList)
  const existingMetadata = ensureMetadata(existing.metadata, buildMetadataFallbacks(existing, existingCharacters))

  const title = normalizeOptionalText(body.title, existing.title)
  const description = normalizeOptionalText(body.description, existing.description)
  const width = parseOptionalPositiveNumber(body.width, existing.width, 'Width')
  const height = parseOptionalPositiveNumber(body.height, existing.height, 'Height')
  const characters = normalizeOptionalCharacters(body.characters, existingMetadata.characters)
  const genre = normalizeOptionalText(body.genre, existing.genre ?? '')

  const metadataBase = {
    ...existingMetadata,
    characters,
    latitude: parseOptionalNullableNumber(body.latitude, existingMetadata.latitude, 'Latitude'),
    longitude: parseOptionalNullableNumber(body.longitude, existingMetadata.longitude, 'Longitude'),
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
