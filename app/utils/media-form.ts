import type { MediaFormState } from '~/types/admin'
import type { FileResponse } from '~/types/file'
import { toLocalInputString } from '~/utils/datetime'

export interface FilledMediaFormState {
  captureTimeLocal: string
  seriesIds: number[]
}

export function createEmptyMediaFormState(): MediaFormState {
  return {
    title: '',
    description: '',
    genre: '',
    width: 0,
    height: 0,
    fanworkTitle: '',
    characters: [],
    location: '',
    locationName: '',
    latitude: null,
    longitude: null,
    cameraModel: '',
    lensModel: '',
    aperture: '',
    focalLength: '',
    iso: '',
    shutterSpeed: '',
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
    captureTime: '',
    notes: '',
  }
}

export function resetMediaFormState(form: MediaFormState): void {
  Object.assign(form, createEmptyMediaFormState())
}

export function fillMediaFormStateFromFile(form: MediaFormState, file: FileResponse): FilledMediaFormState {
  const metadata = file.metadata
  form.title = file.title ?? ''
  form.description = file.description ?? ''
  form.genre = file.genre || ''
  form.width = file.width
  form.height = file.height
  form.fanworkTitle = metadata.fanworkTitle || file.fanworkTitle || ''
  form.characters = metadata.characters ?? file.characters ?? []
  form.location = metadata.location || file.location || ''
  form.locationName = metadata.locationName
  form.latitude = metadata.latitude
  form.longitude = metadata.longitude
  form.cameraModel = metadata.cameraModel || file.cameraModel || ''
  form.lensModel = metadata.lensModel || ''
  form.aperture = metadata.aperture || ''
  form.focalLength = metadata.focalLength || ''
  form.iso = metadata.iso || ''
  form.shutterSpeed = metadata.shutterSpeed || ''
  form.exposureBias = metadata.exposureBias || ''
  form.exposureProgram = metadata.exposureProgram || ''
  form.exposureMode = metadata.exposureMode || ''
  form.meteringMode = metadata.meteringMode || ''
  form.whiteBalance = metadata.whiteBalance || ''
  form.flash = metadata.flash || ''
  form.colorSpace = metadata.colorSpace || ''
  form.resolutionX = metadata.resolutionX || ''
  form.resolutionY = metadata.resolutionY || ''
  form.resolutionUnit = metadata.resolutionUnit || ''
  form.software = metadata.software || ''
  form.captureTime = metadata.captureTime || ''
  form.notes = metadata.notes || ''

  return {
    captureTimeLocal: form.captureTime ? toLocalInputString(form.captureTime) : '',
    seriesIds: [...new Set(file.series.map(item => item.id))],
  }
}
