export interface MediaFormState {
  width: number
  height: number
  title: string
  description: string
  genre: string
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
}

export interface GeocodeResult {
  id: string
  name: string
  placeName: string
  latitude: number
  longitude: number
}
