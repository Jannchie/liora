import type { RecomposeParams } from '#shared/types/recompose'

export type { RecomposeCropRect, RecomposeParams } from '#shared/types/recompose'

export interface HistogramData {
  red: number[]
  green: number[]
  blue: number[]
  luminance: number[]
}

export type UploadProcessingStatus = 'processing' | 'completed' | 'failed'

export interface FileMetadata {
  fanworkTitle: string
  characters: string[]
  location: string
  locationName: string
  latitude: number | null
  longitude: number | null
  cameraModel: string
  lensModel: string
  aperture: string
  focalLength: string
  iso: string
  shutterSpeed: string
  exposureBias: string
  exposureProgram: string
  exposureMode: string
  meteringMode: string
  whiteBalance: string
  flash: string
  colorSpace: string
  resolutionX: string
  resolutionY: string
  resolutionUnit: string
  software: string
  captureTime: string
  focusDistance?: string
  focusFrameSize?: string
  focusLocation?: string
  focusMode?: string
  focusPosition?: string
  hasCrop?: string
  cropLeft?: string
  cropTop?: string
  cropRight?: string
  cropBottom?: string
  cropAngle?: string
  perspectiveHorizontal?: string
  perspectiveVertical?: string
  perspectiveRotate?: string
  perspectiveScale?: string
  perspectiveUpright?: string
  uprightTransform?: string
  lightroomRecipe?: string
  llrRecipe?: string
  notes: string
  fileSize: number
  /** EXIF orientation (1-8) of the stored original; undefined when upright/unknown. */
  orientation?: number
  arthash?: string
  perceptualHash?: string
  sha256?: string
  histogram?: HistogramData | null
  processingStatus?: UploadProcessingStatus
  uploadId?: string
  livePhotoVideoUrl?: string
  livePhotoStillTime?: number
  livePhotoShareImageUrl?: string
  livePhotoShareVideoUrl?: string
  livePhotoShareContentId?: string
  depthMapUrl?: string
  depthMapWidth?: number
  depthMapHeight?: number
  /** Authored display framing; distinct from the read-only Lightroom crop/perspective imports. */
  recompose?: RecomposeParams | null
}

export interface FilePayload {
  width: number
  height: number
  title?: string
  description?: string
  genre?: string
  fanworkTitle?: string
  characters?: string[]
  location?: string
  locationName?: string
  latitude?: number | null
  longitude?: number | null
  cameraModel?: string
  lensModel?: string
  aperture?: string
  focalLength?: string
  iso?: string
  shutterSpeed?: string
  exposureBias?: string
  exposureProgram?: string
  exposureMode?: string
  meteringMode?: string
  whiteBalance?: string
  flash?: string
  colorSpace?: string
  resolutionX?: string
  resolutionY?: string
  resolutionUnit?: string
  software?: string
  captureTime?: string
  focusDistance?: string
  focusFrameSize?: string
  focusLocation?: string
  focusMode?: string
  focusPosition?: string
  hasCrop?: string
  cropLeft?: string
  cropTop?: string
  cropRight?: string
  cropBottom?: string
  cropAngle?: string
  perspectiveHorizontal?: string
  perspectiveVertical?: string
  perspectiveRotate?: string
  perspectiveScale?: string
  perspectiveUpright?: string
  uprightTransform?: string
  lightroomRecipe?: string
  llrRecipe?: string
  notes?: string
}

export const BATCH_METADATA_FIELDS = [
  'title',
  'description',
  'genre',
  'width',
  'height',
  'fanworkTitle',
  'characters',
  'location',
  'locationName',
  'latitude',
  'longitude',
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
  'notes',
] as const

export type BatchMetadataField = (typeof BATCH_METADATA_FIELDS)[number]

export interface BatchMetadataPayload {
  fileIds: number[]
  fieldMask: BatchMetadataField[]
  changes: Partial<FilePayload> & {
    title?: string
    description?: string
    genre?: string
  }
}

export interface BatchSeriesPayload {
  fileIds: number[]
  seriesId: number
  action: 'add'
}

export interface BatchUploadItemPayload {
  imageKey: string
  imageContentType?: string
  originalName?: string
  metadataOverrides?: BatchMetadataPayload['changes']
}

export interface BatchUploadPayload {
  items: BatchUploadItemPayload[]
  fieldMask: BatchMetadataField[]
  sharedChanges: BatchMetadataPayload['changes']
}

export interface BatchActionFailure {
  id: number | null
  message: string
}

export interface BatchActionResult {
  total: number
  success: number
  failed: number
  failures: BatchActionFailure[]
}

export interface BatchUploadItemResult {
  index: number
  originalName: string
  uploadId: string
  status: UploadProcessingStatus | 'unknown'
}

export interface BatchUploadResult {
  total: number
  success: number
  failed: number
  items: BatchUploadItemResult[]
}

export interface FileSummary {
  id: number
  imageUrl: string
  width: number
  height: number
  arthash?: string
  livePhotoVideoUrl?: string
  /** Authored display framing; width/height above are the framed dims when set. */
  recompose?: RecomposeParams
}

export interface FileSeriesRef {
  id: number
  slug: string
  title: string
}

export interface FileResponse {
  id: number
  title: string
  description: string
  originalName: string
  imageUrl: string
  width: number
  height: number
  metadata: FileMetadata
  fanworkTitle: string
  location: string
  cameraModel: string
  characters: string[]
  genre: string
  series: FileSeriesRef[]
  fileSize: number
  createdAt: string
}
