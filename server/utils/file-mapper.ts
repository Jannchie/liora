import type { File, FileKind } from '../../app/generated/prisma/client'
import type { FileMetadata, FileResponse } from '~/types/file'

export function mapCharacters(characterList: string): string[] {
  return characterList
    .split(',')
    .map(value => value.trim())
    .filter(value => value.length > 0)
}

export function joinCharacters(characters: string[]): string {
  return characters
    .map(value => value.trim())
    .filter(value => value.length > 0)
    .join(', ')
}

function parseMetadata(raw: string): Partial<FileMetadata> {
  try {
    return JSON.parse(raw) as Partial<FileMetadata>
  }
  catch {
    return {}
  }
}

export function ensureMetadata(raw: string, fallbacks: Omit<FileMetadata, 'characters'> & { characters: string[] }): FileMetadata {
  const parsed = parseMetadata(raw)
  return {
    fanworkTitle: parsed.fanworkTitle ?? fallbacks.fanworkTitle,
    characters: parsed.characters ?? fallbacks.characters,
    location: parsed.location ?? fallbacks.location,
    locationName: parsed.locationName ?? fallbacks.locationName,
    latitude: parsed.latitude ?? fallbacks.latitude,
    longitude: parsed.longitude ?? fallbacks.longitude,
    cameraModel: parsed.cameraModel ?? fallbacks.cameraModel,
    aperture: parsed.aperture ?? fallbacks.aperture,
    focalLength: parsed.focalLength ?? fallbacks.focalLength,
    iso: parsed.iso ?? fallbacks.iso,
    shutterSpeed: parsed.shutterSpeed ?? fallbacks.shutterSpeed,
    captureTime: parsed.captureTime ?? fallbacks.captureTime,
    notes: parsed.notes ?? fallbacks.notes,
    thumbhash: parsed.thumbhash ?? fallbacks.thumbhash,
    perceptualHash: parsed.perceptualHash ?? fallbacks.perceptualHash,
    sha256: parsed.sha256 ?? fallbacks.sha256,
    histogram: parsed.histogram ?? fallbacks.histogram,
  }
}

export function ensureKind(value: FileKind | string | undefined, fallback: FileKind): FileKind {
  if (value === 'PAINTING' || value === 'PHOTOGRAPHY') {
    return value
  }
  return fallback
}

export function toFileResponse(file: File): FileResponse {
  const characters = mapCharacters(file.characterList)
  const metadata = ensureMetadata(file.metadata, {
    fanworkTitle: file.fanworkTitle,
    characters,
    location: file.location,
    locationName: file.locationName,
    latitude: file.latitude ?? null,
    longitude: file.longitude ?? null,
    cameraModel: file.cameraModel,
    aperture: file.aperture,
    focalLength: file.focalLength,
    iso: file.iso,
    shutterSpeed: file.shutterSpeed,
    captureTime: file.captureTime,
    notes: '',
    thumbhash: undefined,
    perceptualHash: undefined,
    sha256: undefined,
    histogram: null,
  })
  const imageUrl = file.imageUrl || file.thumbnailUrl || ''

  return {
    id: file.id,
    kind: file.kind,
    title: file.title,
    description: file.description,
    originalName: file.originalName,
    imageUrl,
    thumbnailUrl: imageUrl,
    width: file.width,
    height: file.height,
    fanworkTitle: file.fanworkTitle,
    location: file.location,
    cameraModel: file.cameraModel,
    characters,
    metadata,
    createdAt: file.createdAt.toISOString(),
  }
}
