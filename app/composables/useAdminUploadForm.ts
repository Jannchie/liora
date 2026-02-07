import type { MediaFormState } from '~/types/admin'
import { computed, reactive } from 'vue'

function createInitialFormState(): MediaFormState {
  return {
    width: 0,
    height: 0,
    title: '',
    description: '',
    genre: '',
    fanworkTitle: '',
    characters: [],
    location: '',
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
    locationName: '',
    latitude: null,
    longitude: null,
    notes: '',
  }
}

export function useAdminUploadForm() {
  const form = reactive<MediaFormState>(createInitialFormState())
  const formModel = computed<MediaFormState>({
    get: () => form,
    set: (value) => {
      Object.assign(form, value)
    },
  })

  const resetOptionalFields = (captureTimeLocal: { value: string }): void => {
    form.title = ''
    form.description = ''
    form.genre = ''
    form.fanworkTitle = ''
    form.characters = []
    form.location = ''
    form.locationName = ''
    form.latitude = null
    form.longitude = null
    form.cameraModel = ''
    form.lensModel = ''
    form.aperture = ''
    form.focalLength = ''
    form.iso = ''
    form.shutterSpeed = ''
    form.exposureBias = ''
    form.exposureProgram = ''
    form.exposureMode = ''
    form.meteringMode = ''
    form.whiteBalance = ''
    form.flash = ''
    form.colorSpace = ''
    form.resolutionX = ''
    form.resolutionY = ''
    form.resolutionUnit = ''
    form.software = ''
    form.captureTime = ''
    captureTimeLocal.value = ''
    form.notes = ''
  }

  return {
    form,
    formModel,
    resetOptionalFields,
  }
}
