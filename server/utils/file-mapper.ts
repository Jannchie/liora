import type { FileRow } from './db'
import type { FileMetadata, FileResponse, FileSeriesRef } from '~/types/file'
import { validateRecomposeParams } from '../../shared/utils/recompose'

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

function parseTextMetadataField(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }
  return undefined
}

export function ensureMetadata(raw: string, fallbacks: Omit<FileMetadata, 'characters'> & { characters: string[] }): FileMetadata {
  const parsed = parseMetadata(raw)
  const parsedFileSize = typeof parsed.fileSize === 'number' ? parsed.fileSize : Number(parsed.fileSize)
  const parsedLivePhotoVideoUrl = typeof parsed.livePhotoVideoUrl === 'string' ? parsed.livePhotoVideoUrl : undefined
  const parsedLivePhotoStillTime = typeof parsed.livePhotoStillTime === 'number'
    ? parsed.livePhotoStillTime
    : Number(parsed.livePhotoStillTime)
  const parsedDepthMapUrl = typeof parsed.depthMapUrl === 'string' ? parsed.depthMapUrl : undefined
  const parsedDepthMapWidth = typeof parsed.depthMapWidth === 'number'
    ? parsed.depthMapWidth
    : Number(parsed.depthMapWidth)
  const parsedDepthMapHeight = typeof parsed.depthMapHeight === 'number'
    ? parsed.depthMapHeight
    : Number(parsed.depthMapHeight)
  const parsedShareImageUrl = typeof parsed.livePhotoShareImageUrl === 'string'
    ? parsed.livePhotoShareImageUrl
    : undefined
  const parsedShareVideoUrl = typeof parsed.livePhotoShareVideoUrl === 'string'
    ? parsed.livePhotoShareVideoUrl
    : undefined
  const parsedShareContentId = typeof parsed.livePhotoShareContentId === 'string'
    ? parsed.livePhotoShareContentId
    : undefined
  const parsedFocusDistance = parseTextMetadataField(parsed.focusDistance)
  const parsedFocusFrameSize = parseTextMetadataField(parsed.focusFrameSize)
  const parsedFocusLocation = parseTextMetadataField(parsed.focusLocation)
  const parsedFocusMode = parseTextMetadataField(parsed.focusMode)
  const parsedFocusPosition = parseTextMetadataField(parsed.focusPosition)
  const parsedHasCrop = parseTextMetadataField(parsed.hasCrop)
  const parsedCropLeft = parseTextMetadataField(parsed.cropLeft)
  const parsedCropTop = parseTextMetadataField(parsed.cropTop)
  const parsedCropRight = parseTextMetadataField(parsed.cropRight)
  const parsedCropBottom = parseTextMetadataField(parsed.cropBottom)
  const parsedCropAngle = parseTextMetadataField(parsed.cropAngle)
  const parsedPerspectiveHorizontal = parseTextMetadataField(parsed.perspectiveHorizontal)
  const parsedPerspectiveVertical = parseTextMetadataField(parsed.perspectiveVertical)
  const parsedPerspectiveRotate = parseTextMetadataField(parsed.perspectiveRotate)
  const parsedPerspectiveScale = parseTextMetadataField(parsed.perspectiveScale)
  const parsedPerspectiveUpright = parseTextMetadataField(parsed.perspectiveUpright)
  const parsedUprightTransform = parseTextMetadataField(parsed.uprightTransform)
  const parsedLightroomRecipe = parseTextMetadataField(parsed.lightroomRecipe)
  const parsedLlrRecipe = parseTextMetadataField(parsed.llrRecipe)
  const livePhotoStillTime = Number.isFinite(parsedLivePhotoStillTime) && parsedLivePhotoStillTime >= 0
    ? parsedLivePhotoStillTime
    : fallbacks.livePhotoStillTime
  const depthMapWidth = Number.isFinite(parsedDepthMapWidth) && parsedDepthMapWidth > 0
    ? parsedDepthMapWidth
    : fallbacks.depthMapWidth
  const depthMapHeight = Number.isFinite(parsedDepthMapHeight) && parsedDepthMapHeight > 0
    ? parsedDepthMapHeight
    : fallbacks.depthMapHeight
  const parsedOrientation = typeof parsed.orientation === 'number'
    ? parsed.orientation
    : Number(parsed.orientation)
  const orientation = Number.isInteger(parsedOrientation) && parsedOrientation >= 1 && parsedOrientation <= 8
    ? parsedOrientation
    : fallbacks.orientation
  const recompose = validateRecomposeParams(parsed.recompose) ?? fallbacks.recompose
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
    focusDistance: parsedFocusDistance ?? fallbacks.focusDistance,
    focusFrameSize: parsedFocusFrameSize ?? fallbacks.focusFrameSize,
    focusLocation: parsedFocusLocation ?? fallbacks.focusLocation,
    focusMode: parsedFocusMode ?? fallbacks.focusMode,
    focusPosition: parsedFocusPosition ?? fallbacks.focusPosition,
    hasCrop: parsedHasCrop ?? fallbacks.hasCrop,
    cropLeft: parsedCropLeft ?? fallbacks.cropLeft,
    cropTop: parsedCropTop ?? fallbacks.cropTop,
    cropRight: parsedCropRight ?? fallbacks.cropRight,
    cropBottom: parsedCropBottom ?? fallbacks.cropBottom,
    cropAngle: parsedCropAngle ?? fallbacks.cropAngle,
    perspectiveHorizontal: parsedPerspectiveHorizontal ?? fallbacks.perspectiveHorizontal,
    perspectiveVertical: parsedPerspectiveVertical ?? fallbacks.perspectiveVertical,
    perspectiveRotate: parsedPerspectiveRotate ?? fallbacks.perspectiveRotate,
    perspectiveScale: parsedPerspectiveScale ?? fallbacks.perspectiveScale,
    perspectiveUpright: parsedPerspectiveUpright ?? fallbacks.perspectiveUpright,
    uprightTransform: parsedUprightTransform ?? fallbacks.uprightTransform,
    lightroomRecipe: parsedLightroomRecipe ?? fallbacks.lightroomRecipe,
    llrRecipe: parsedLlrRecipe ?? fallbacks.llrRecipe,
    notes: parsed.notes ?? fallbacks.notes,
    fileSize: Number.isFinite(parsedFileSize) && parsedFileSize >= 0 ? parsedFileSize : fallbacks.fileSize,
    orientation,
    arthash: parsed.arthash ?? fallbacks.arthash,
    perceptualHash: parsed.perceptualHash ?? fallbacks.perceptualHash,
    sha256: parsed.sha256 ?? fallbacks.sha256,
    histogram: parsed.histogram ?? fallbacks.histogram,
    processingStatus: parsed.processingStatus ?? fallbacks.processingStatus,
    uploadId: parsed.uploadId ?? fallbacks.uploadId,
    livePhotoVideoUrl: parsedLivePhotoVideoUrl ?? fallbacks.livePhotoVideoUrl,
    livePhotoStillTime,
    livePhotoShareImageUrl: parsedShareImageUrl ?? fallbacks.livePhotoShareImageUrl,
    livePhotoShareVideoUrl: parsedShareVideoUrl ?? fallbacks.livePhotoShareVideoUrl,
    livePhotoShareContentId: parsedShareContentId ?? fallbacks.livePhotoShareContentId,
    depthMapUrl: parsedDepthMapUrl ?? fallbacks.depthMapUrl,
    depthMapWidth,
    depthMapHeight,
    recompose,
  }
}

type MetadataFallbackRow = Pick<FileRow, | 'fanworkTitle'
  | 'location'
  | 'locationName'
  | 'latitude'
  | 'longitude'
  | 'cameraModel'
  | 'aperture'
  | 'focalLength'
  | 'iso'
  | 'shutterSpeed'
  | 'captureTime'>

export function buildMetadataFallbacks(
  file: MetadataFallbackRow,
  characters: string[],
  overrides: Partial<Omit<FileMetadata, 'characters'>> = {},
): Omit<FileMetadata, 'characters'> & { characters: string[] } {
  return {
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
    focusDistance: undefined,
    focusFrameSize: undefined,
    focusLocation: undefined,
    focusMode: undefined,
    focusPosition: undefined,
    hasCrop: undefined,
    cropLeft: undefined,
    cropTop: undefined,
    cropRight: undefined,
    cropBottom: undefined,
    cropAngle: undefined,
    perspectiveHorizontal: undefined,
    perspectiveVertical: undefined,
    perspectiveRotate: undefined,
    perspectiveScale: undefined,
    perspectiveUpright: undefined,
    uprightTransform: undefined,
    lightroomRecipe: undefined,
    llrRecipe: undefined,
    notes: '',
    fileSize: 0,
    orientation: undefined,
    arthash: undefined,
    perceptualHash: undefined,
    sha256: undefined,
    histogram: null,
    processingStatus: 'completed',
    uploadId: '',
    livePhotoVideoUrl: '',
    livePhotoStillTime: undefined,
    livePhotoShareImageUrl: undefined,
    livePhotoShareVideoUrl: undefined,
    livePhotoShareContentId: undefined,
    depthMapUrl: undefined,
    depthMapWidth: undefined,
    depthMapHeight: undefined,
    recompose: undefined,
    ...overrides,
  }
}

export function toFileResponse(file: FileRow, options?: { series?: FileSeriesRef[] }): FileResponse {
  const characters = mapCharacters(file.characterList)
  const metadata = ensureMetadata(file.metadata, buildMetadataFallbacks(file, characters))
  const imageUrl = file.imageUrl || ''
  const genre = file.genre?.trim() ?? ''
  const createdAt = new Date(file.createdAt)

  return {
    id: file.id,
    title: file.title,
    description: file.description,
    originalName: file.originalName,
    imageUrl,
    width: file.width,
    height: file.height,
    fanworkTitle: file.fanworkTitle,
    location: file.location,
    cameraModel: file.cameraModel,
    characters,
    metadata,
    genre,
    series: options?.series ?? [],
    fileSize: metadata.fileSize,
    createdAt: Number.isNaN(createdAt.getTime()) ? new Date().toISOString() : createdAt.toISOString(),
  }
}
