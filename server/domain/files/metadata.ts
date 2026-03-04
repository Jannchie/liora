import type { FileMetadata } from '~/types/file'
import { createError } from 'h3'
import { joinCharacters } from '../../utils/file-mapper'

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
  focusDistance: { max: 64, label: 'Focus distance' },
  focusFrameSize: { max: 64, label: 'Focus frame size' },
  focusLocation: { max: 64, label: 'Focus location' },
  focusMode: { max: 64, label: 'Focus mode' },
  focusPosition: { max: 64, label: 'Focus position' },
  hasCrop: { max: 16, label: 'Has crop' },
  cropLeft: { max: 32, label: 'Crop left' },
  cropTop: { max: 32, label: 'Crop top' },
  cropRight: { max: 32, label: 'Crop right' },
  cropBottom: { max: 32, label: 'Crop bottom' },
  cropAngle: { max: 32, label: 'Crop angle' },
  perspectiveHorizontal: { max: 32, label: 'Perspective horizontal' },
  perspectiveVertical: { max: 32, label: 'Perspective vertical' },
  perspectiveRotate: { max: 32, label: 'Perspective rotate' },
  perspectiveScale: { max: 32, label: 'Perspective scale' },
  perspectiveUpright: { max: 32, label: 'Perspective upright' },
  uprightTransform: { max: 256, label: 'Upright transform' },
  lightroomRecipe: { max: 16_000, label: 'Lightroom recipe' },
  notes: { max: 4000, label: 'Notes' },
  originalName: { max: 512, label: 'Original filename' },
} as const

export const normalizeText = (value: string | undefined): string => value?.trim() ?? ''

export const METADATA_TEXT_FIELDS = [
  'fanworkTitle',
  'location',
  'locationName',
  'cameraModel',
  'lensModel',
  'aperture',
  'focalLength',
  'iso',
  'shutterSpeed',
  'exposureBias',
  'exposureProgram',
  'exposureMode',
  'meteringMode',
  'whiteBalance',
  'flash',
  'colorSpace',
  'resolutionX',
  'resolutionY',
  'resolutionUnit',
  'software',
  'captureTime',
  'focusDistance',
  'focusFrameSize',
  'focusLocation',
  'focusMode',
  'focusPosition',
  'hasCrop',
  'cropLeft',
  'cropTop',
  'cropRight',
  'cropBottom',
  'cropAngle',
  'perspectiveHorizontal',
  'perspectiveVertical',
  'perspectiveRotate',
  'perspectiveScale',
  'perspectiveUpright',
  'uprightTransform',
  'lightroomRecipe',
  'notes',
] as const

export type MetadataTextField = (typeof METADATA_TEXT_FIELDS)[number]

export function readMetadataTextValues(source: Partial<Record<MetadataTextField, string | undefined>>): Record<MetadataTextField, string> {
  const values = {} as Record<MetadataTextField, string>
  for (const field of METADATA_TEXT_FIELDS) {
    values[field] = normalizeText(source[field])
  }
  return values
}

export function normalizeMetadataTextUpdates(
  source: Partial<Record<MetadataTextField, string | undefined>>,
): Partial<Record<MetadataTextField, string>> {
  const updates: Partial<Record<MetadataTextField, string>> = {}
  for (const field of METADATA_TEXT_FIELDS) {
    const value = source[field]
    if (value === undefined) {
      continue
    }
    updates[field] = normalizeText(value)
  }
  return updates
}

export function mergeMetadataTextUpdates(
  base: FileMetadata,
  updates: Partial<Record<MetadataTextField, string>>,
  options: {
    preserveOnEmpty?: boolean
  } = {},
): FileMetadata {
  const next: FileMetadata = { ...base }
  for (const field of METADATA_TEXT_FIELDS) {
    const value = updates[field]
    if (value === undefined) {
      continue
    }
    if (options.preserveOnEmpty && value.length === 0) {
      continue
    }
    next[field] = value
  }
  return next
}

export function parseCharacters(raw: string | string[] | undefined): string[] {
  if (Array.isArray(raw)) {
    return raw.map(value => value.trim()).filter(value => value.length > 0)
  }
  return (raw ?? '')
    .split(/[,，\n]/)
    .map(value => value.trim())
    .filter(value => value.length > 0)
}

export function buildMetadata(fields: Record<string, string>, characters: string[]): FileMetadata {
  const parsedStillTime = fields.livePhotoStillTime ? Number(fields.livePhotoStillTime) : Number.NaN
  const livePhotoStillTime = Number.isFinite(parsedStillTime) && parsedStillTime >= 0 ? parsedStillTime : undefined
  const textValues = readMetadataTextValues(fields)
  return {
    ...textValues,
    characters,
    latitude: fields.latitude ? Number(fields.latitude) : null,
    longitude: fields.longitude ? Number(fields.longitude) : null,
    fileSize: 0,
    thumbhash: undefined,
    perceptualHash: undefined,
    sha256: undefined,
    livePhotoStillTime,
  }
}

function escapeRegExp(value: string): string {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\\$&`)
}

export function stripLensFromCamera(cameraModel: string, lensModel: string): { cameraModel: string, lensModel: string } {
  const camera = cameraModel.trim()
  const lens = lensModel.trim()
  const separators = ['·', '|', '/']

  if (lens.length > 0) {
    const pattern = new RegExp(String.raw`\s*[·|/,-]?\s*${escapeRegExp(lens)}`, 'gi')
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

function assertLength(value: string, limit: number, label: string): void {
  if (value.length <= limit) {
    return
  }
  throw createError({
    statusCode: 400,
    statusMessage: `${label} exceeds the maximum length of ${limit} characters.`,
  })
}

export function validateLengths(payload: {
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
  assertLength(payload.metadata.focusDistance ?? '', LENGTH_LIMITS.focusDistance.max, LENGTH_LIMITS.focusDistance.label)
  assertLength(payload.metadata.focusFrameSize ?? '', LENGTH_LIMITS.focusFrameSize.max, LENGTH_LIMITS.focusFrameSize.label)
  assertLength(payload.metadata.focusLocation ?? '', LENGTH_LIMITS.focusLocation.max, LENGTH_LIMITS.focusLocation.label)
  assertLength(payload.metadata.focusMode ?? '', LENGTH_LIMITS.focusMode.max, LENGTH_LIMITS.focusMode.label)
  assertLength(payload.metadata.focusPosition ?? '', LENGTH_LIMITS.focusPosition.max, LENGTH_LIMITS.focusPosition.label)
  assertLength(payload.metadata.hasCrop ?? '', LENGTH_LIMITS.hasCrop.max, LENGTH_LIMITS.hasCrop.label)
  assertLength(payload.metadata.cropLeft ?? '', LENGTH_LIMITS.cropLeft.max, LENGTH_LIMITS.cropLeft.label)
  assertLength(payload.metadata.cropTop ?? '', LENGTH_LIMITS.cropTop.max, LENGTH_LIMITS.cropTop.label)
  assertLength(payload.metadata.cropRight ?? '', LENGTH_LIMITS.cropRight.max, LENGTH_LIMITS.cropRight.label)
  assertLength(payload.metadata.cropBottom ?? '', LENGTH_LIMITS.cropBottom.max, LENGTH_LIMITS.cropBottom.label)
  assertLength(payload.metadata.cropAngle ?? '', LENGTH_LIMITS.cropAngle.max, LENGTH_LIMITS.cropAngle.label)
  assertLength(payload.metadata.perspectiveHorizontal ?? '', LENGTH_LIMITS.perspectiveHorizontal.max, LENGTH_LIMITS.perspectiveHorizontal.label)
  assertLength(payload.metadata.perspectiveVertical ?? '', LENGTH_LIMITS.perspectiveVertical.max, LENGTH_LIMITS.perspectiveVertical.label)
  assertLength(payload.metadata.perspectiveRotate ?? '', LENGTH_LIMITS.perspectiveRotate.max, LENGTH_LIMITS.perspectiveRotate.label)
  assertLength(payload.metadata.perspectiveScale ?? '', LENGTH_LIMITS.perspectiveScale.max, LENGTH_LIMITS.perspectiveScale.label)
  assertLength(payload.metadata.perspectiveUpright ?? '', LENGTH_LIMITS.perspectiveUpright.max, LENGTH_LIMITS.perspectiveUpright.label)
  assertLength(payload.metadata.uprightTransform ?? '', LENGTH_LIMITS.uprightTransform.max, LENGTH_LIMITS.uprightTransform.label)
  assertLength(payload.metadata.lightroomRecipe ?? '', LENGTH_LIMITS.lightroomRecipe.max, LENGTH_LIMITS.lightroomRecipe.label)
  assertLength(payload.metadata.notes, LENGTH_LIMITS.notes.max, LENGTH_LIMITS.notes.label)
  assertLength(payload.originalName, LENGTH_LIMITS.originalName.max, LENGTH_LIMITS.originalName.label)

  for (const character of payload.characters) {
    assertLength(character, LENGTH_LIMITS.character.max, LENGTH_LIMITS.character.label)
  }
  assertLength(joinCharacters(payload.characters), LENGTH_LIMITS.characterList.max, LENGTH_LIMITS.characterList.label)
}
