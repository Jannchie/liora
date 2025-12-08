import type { FileRow } from './db'
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
  const parsedFileSize = typeof parsed.fileSize === 'number' ? parsed.fileSize : Number(parsed.fileSize)
  return {
    fanworkTitle: parsed.fanworkTitle ?? fallbacks.fanworkTitle,
    characters: parsed.characters ?? fallbacks.characters,
    location: parsed.location ?? fallbacks.location,
    locationName: parsed.locationName ?? fallbacks.locationName,
    latitude: parsed.latitude ?? fallbacks.latitude,
    longitude: parsed.longitude ?? fallbacks.longitude,
    cameraModel: parsed.cameraModel ?? fallbacks.cameraModel,
    lensModel: parsed.lensModel ?? fallbacks.lensModel,
    aperture: parsed.aperture ?? fallbacks.aperture,
    focalLength: parsed.focalLength ?? fallbacks.focalLength,
    iso: parsed.iso ?? fallbacks.iso,
    shutterSpeed: parsed.shutterSpeed ?? fallbacks.shutterSpeed,
    exposureBias: parsed.exposureBias ?? fallbacks.exposureBias,
    exposureProgram: parsed.exposureProgram ?? fallbacks.exposureProgram,
    exposureMode: parsed.exposureMode ?? fallbacks.exposureMode,
    meteringMode: parsed.meteringMode ?? fallbacks.meteringMode,
    whiteBalance: parsed.whiteBalance ?? fallbacks.whiteBalance,
    flash: parsed.flash ?? fallbacks.flash,
    colorSpace: parsed.colorSpace ?? fallbacks.colorSpace,
    resolutionX: parsed.resolutionX ?? fallbacks.resolutionX,
    resolutionY: parsed.resolutionY ?? fallbacks.resolutionY,
    resolutionUnit: parsed.resolutionUnit ?? fallbacks.resolutionUnit,
    software: parsed.software ?? fallbacks.software,
    captureTime: parsed.captureTime ?? fallbacks.captureTime,
    notes: parsed.notes ?? fallbacks.notes,
    fileSize: Number.isFinite(parsedFileSize) && parsedFileSize >= 0 ? parsedFileSize : fallbacks.fileSize,
    thumbhash: parsed.thumbhash ?? fallbacks.thumbhash,
    perceptualHash: parsed.perceptualHash ?? fallbacks.perceptualHash,
    sha256: parsed.sha256 ?? fallbacks.sha256,
    histogram: parsed.histogram ?? fallbacks.histogram,
    processingStatus: parsed.processingStatus ?? fallbacks.processingStatus,
    uploadId: parsed.uploadId ?? fallbacks.uploadId,
  }
}

export function toFileResponse(file: FileRow): FileResponse {
  const characters = mapCharacters(file.characterList)
  const metadata = ensureMetadata(file.metadata, {
    fanworkTitle: file.fanworkTitle,
    characters,
    location: file.location,
    locationName: file.locationName,
    latitude: file.latitude ?? null,
    longitude: file.longitude ?? null,
    cameraModel: file.cameraModel,
    lensModel: '',
    aperture: file.aperture,
    focalLength: file.focalLength,
    iso: file.iso,
    shutterSpeed: file.shutterSpeed,
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
    captureTime: file.captureTime,
    notes: '',
    fileSize: 0,
    thumbhash: undefined,
    perceptualHash: undefined,
    sha256: undefined,
    histogram: null,
    processingStatus: 'completed',
    uploadId: '',
  })
  const imageUrl = file.imageUrl || ''
  const genre = file.genre?.trim() ?? ''
  const createdAt = file.createdAt instanceof Date ? file.createdAt : new Date(file.createdAt)

  return {
    id: file.id,
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
    genre,
    fileSize: metadata.fileSize,
    createdAt: Number.isNaN(createdAt.getTime()) ? new Date().toISOString() : createdAt.toISOString(),
  }
}
