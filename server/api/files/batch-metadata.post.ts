import type { MetadataTextField } from '../../domain/files/metadata'
import type { BatchActionResult, BatchMetadataField, BatchMetadataPayload } from '~/types/file'
import { eq, inArray } from 'drizzle-orm'
import { readBody } from 'h3'
import { parseBatchMetadataPayload, pickMaskedChanges } from '../../domain/files/batch'
import {
  mergeMetadataTextUpdates,
  METADATA_TEXT_FIELDS,

  normalizeMetadataTextUpdates,
  parseCharacters,
  validateLengths,
} from '../../domain/files/metadata'
import { requireAdmin } from '../../utils/auth'
import { db, files } from '../../utils/db'
import { buildMetadataFallbacks, ensureMetadata, joinCharacters, mapCharacters } from '../../utils/file-mapper'

function parseStringValue(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new TypeError(`${field} must be a string.`)
  }
  return value.trim()
}

function parsePositiveValue(value: unknown, field: string): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new TypeError(`${field} must be a positive number.`)
  }
  return parsed
}

function parseNullableValue(value: unknown, field: string): number | null {
  if (value === null) {
    return null
  }
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) {
    throw new TypeError(`${field} must be a valid number.`)
  }
  return parsed
}

function hasField(maskSet: Set<BatchMetadataField>, field: BatchMetadataField): boolean {
  return maskSet.has(field)
}

function buildMetadataTextUpdates(
  maskSet: Set<BatchMetadataField>,
  changes: BatchMetadataPayload['changes'],
): Partial<Record<MetadataTextField, string>> {
  const maskKeySet = new Set<string>(maskSet)
  const source: Partial<Record<MetadataTextField, string | undefined>> = {}
  for (const field of METADATA_TEXT_FIELDS) {
    if (!maskKeySet.has(field)) {
      continue
    }
    source[field] = parseStringValue(changes[field as BatchMetadataField], field)
  }
  return normalizeMetadataTextUpdates(source)
}

export default defineEventHandler(async (event): Promise<BatchActionResult> => {
  requireAdmin(event)
  const body = await readBody<BatchMetadataPayload>(event)
  const { fileIds, fieldMask, changes } = parseBatchMetadataPayload(body)
  const maskedChanges = pickMaskedChanges(changes, fieldMask)
  const maskSet = new Set<BatchMetadataField>(fieldMask)

  const rows = await db.query.files.findMany({
    where: inArray(files.id, fileIds),
  })
  const rowMap = new Map<number, (typeof rows)[number]>()
  for (const row of rows) {
    rowMap.set(row.id, row)
  }

  let success = 0
  const failures: BatchActionResult['failures'] = []

  for (const fileId of fileIds) {
    const current = rowMap.get(fileId)
    if (!current) {
      failures.push({ id: fileId, message: 'File not found.' })
      continue
    }

    try {
      const currentCharacters = mapCharacters(current.characterList)
      const currentMetadata = ensureMetadata(current.metadata, buildMetadataFallbacks(current, currentCharacters))

      const nextTitle = hasField(maskSet, 'title')
        ? parseStringValue(maskedChanges.title, 'title')
        : current.title
      const nextDescription = hasField(maskSet, 'description')
        ? parseStringValue(maskedChanges.description, 'description')
        : current.description
      const nextGenre = hasField(maskSet, 'genre')
        ? parseStringValue(maskedChanges.genre, 'genre')
        : current.genre
      const nextWidth = hasField(maskSet, 'width')
        ? parsePositiveValue(maskedChanges.width, 'width')
        : current.width
      const nextHeight = hasField(maskSet, 'height')
        ? parsePositiveValue(maskedChanges.height, 'height')
        : current.height
      const nextCharacters = hasField(maskSet, 'characters')
        ? parseCharacters(maskedChanges.characters)
        : currentMetadata.characters
      const nextLatitude = hasField(maskSet, 'latitude')
        ? parseNullableValue(maskedChanges.latitude, 'latitude')
        : currentMetadata.latitude
      const nextLongitude = hasField(maskSet, 'longitude')
        ? parseNullableValue(maskedChanges.longitude, 'longitude')
        : currentMetadata.longitude

      const metadataBase = {
        ...currentMetadata,
        characters: nextCharacters,
        latitude: nextLatitude,
        longitude: nextLongitude,
      }
      const metadataTextUpdates = buildMetadataTextUpdates(maskSet, maskedChanges)
      const mergedMetadata = mergeMetadataTextUpdates(metadataBase, metadataTextUpdates)

      validateLengths({
        title: nextTitle,
        description: nextDescription,
        genre: nextGenre,
        metadata: mergedMetadata,
        characters: nextCharacters,
        originalName: current.originalName,
      })

      await db
        .update(files)
        .set({
          title: nextTitle,
          description: nextDescription,
          width: nextWidth,
          height: nextHeight,
          fanworkTitle: mergedMetadata.fanworkTitle,
          characterList: joinCharacters(mergedMetadata.characters),
          genre: nextGenre,
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
        .where(eq(files.id, fileId))

      success += 1
    }
    catch (error) {
      failures.push({
        id: fileId,
        message: error instanceof Error ? error.message : 'Failed to update metadata.',
      })
    }
  }

  return {
    total: fileIds.length,
    success,
    failed: failures.length,
    failures,
  }
})
