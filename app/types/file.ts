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
  notes: string
  fileSize: number
  thumbhash?: string
  perceptualHash?: string
  sha256?: string
  histogram?: HistogramData | null
  processingStatus?: UploadProcessingStatus
  uploadId?: string
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
  notes?: string
}

export interface FileResponse {
  id: number
  title: string
  description: string
  originalName: string
  imageUrl: string
  thumbnailUrl: string
  width: number
  height: number
  metadata: FileMetadata
  fanworkTitle: string
  location: string
  cameraModel: string
  characters: string[]
  genre: string
  fileSize: number
  createdAt: string
}
