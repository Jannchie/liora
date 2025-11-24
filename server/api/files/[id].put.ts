import type { H3Event } from 'h3'
import type { FilePayload, FileResponse } from '~/types/file'
import { createError, getRouterParam, readBody } from 'h3'
import { requireAdmin } from '../../utils/auth'
import { ensureKind, ensureMetadata, joinCharacters, mapCharacters, toFileResponse } from '../../utils/file-mapper'
import { prisma } from '../../utils/prisma'

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

export default defineEventHandler(async (event): Promise<FileResponse> => {
  requireAdmin(event)
  const id = parseId(event)
  const body = await readBody<UpdateBody>(event)

  const existing = await prisma.file.findUnique({ where: { id } })
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'File not found.' })
  }

  const existingCharacters = mapCharacters(existing.characterList)
  const existingMetadata = ensureMetadata(existing.metadata, {
    fanworkTitle: existing.fanworkTitle,
    characters: existingCharacters,
    location: existing.location,
    locationName: existing.locationName,
    latitude: existing.latitude ?? null,
    longitude: existing.longitude ?? null,
    cameraModel: existing.cameraModel,
    aperture: existing.aperture,
    focalLength: existing.focalLength,
    iso: existing.iso,
    shutterSpeed: existing.shutterSpeed,
    captureTime: existing.captureTime,
    notes: '',
    thumbhash: undefined,
    perceptualHash: undefined,
    sha256: undefined,
  })

  const kind = ensureKind(body.kind, existing.kind)
  const title = normalizeText(body.title, existing.title)
  const description = normalizeText(body.description, existing.description)
  const width = parsePositiveNumber(body.width, existing.width, 'Width')
  const height = parsePositiveNumber(body.height, existing.height, 'Height')
  const characters = normalizeCharacters(body.characters, existingMetadata.characters)

  const mergedMetadata = {
    ...existingMetadata,
    fanworkTitle: normalizeText(body.fanworkTitle, existingMetadata.fanworkTitle),
    characters,
    location: normalizeText(body.location, existingMetadata.location),
    locationName: normalizeText(body.locationName, existingMetadata.locationName),
    latitude: parseNullableNumber(body.latitude, existingMetadata.latitude, 'Latitude'),
    longitude: parseNullableNumber(body.longitude, existingMetadata.longitude, 'Longitude'),
    cameraModel: normalizeText(body.cameraModel, existingMetadata.cameraModel),
    aperture: normalizeText(body.aperture, existingMetadata.aperture),
    focalLength: normalizeText(body.focalLength, existingMetadata.focalLength),
    iso: normalizeText(body.iso, existingMetadata.iso),
    shutterSpeed: normalizeText(body.shutterSpeed, existingMetadata.shutterSpeed),
    captureTime: normalizeText(body.captureTime, existingMetadata.captureTime),
    notes: normalizeText(body.notes, existingMetadata.notes),
  }

  const updated = await prisma.file.update({
    where: { id },
    data: {
      kind,
      title,
      description,
      width,
      height,
      fanworkTitle: mergedMetadata.fanworkTitle,
      characterList: joinCharacters(mergedMetadata.characters),
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
    },
  })

  return toFileResponse(updated)
})
