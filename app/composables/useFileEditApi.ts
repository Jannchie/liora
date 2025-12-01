import type { MediaFormState } from '~/types/admin'
import type { FileResponse } from '~/types/file'
import { useRequestFetch } from '#imports'

function normalizeDimensions(form: MediaFormState, fallbackWidth: number, fallbackHeight: number): { width: number, height: number } {
  const width = Math.max(form.width, fallbackWidth, 0)
  const height = Math.max(form.height, fallbackHeight, 0)
  return { width, height }
}

function buildMultipartBody(form: MediaFormState, file: File, width: number, height: number): FormData {
  const body = new FormData()
  body.append('file', file)
  body.append('width', String(width))
  body.append('height', String(height))
  body.append('title', form.title)
  body.append('description', form.description)
  body.append('genre', form.genre)
  body.append('fanworkTitle', form.fanworkTitle)
  body.append('characters', (form.characters ?? []).join(','))
  body.append('location', form.location)
  body.append('locationName', form.locationName)
  body.append('latitude', form.latitude === null ? '' : String(form.latitude))
  body.append('longitude', form.longitude === null ? '' : String(form.longitude))
  body.append('cameraModel', form.cameraModel)
  body.append('lensModel', form.lensModel)
  body.append('aperture', form.aperture)
  body.append('focalLength', form.focalLength)
  body.append('iso', form.iso)
  body.append('shutterSpeed', form.shutterSpeed)
  body.append('exposureBias', form.exposureBias)
  body.append('exposureProgram', form.exposureProgram)
  body.append('exposureMode', form.exposureMode)
  body.append('meteringMode', form.meteringMode)
  body.append('whiteBalance', form.whiteBalance)
  body.append('flash', form.flash)
  body.append('colorSpace', form.colorSpace)
  body.append('resolutionX', form.resolutionX)
  body.append('resolutionY', form.resolutionY)
  body.append('resolutionUnit', form.resolutionUnit)
  body.append('software', form.software)
  body.append('captureTime', form.captureTime)
  body.append('notes', form.notes)
  return body
}

export function useFileEditApi() {
  const request = useRequestFetch()

  const updateFile = async (
    id: number,
    form: MediaFormState,
    replaceFile: File | null,
    fallbackWidth: number,
    fallbackHeight: number,
  ): Promise<FileResponse> => {
    const { width, height } = normalizeDimensions(form, fallbackWidth, fallbackHeight)

    if (replaceFile) {
      const formData = buildMultipartBody(form, replaceFile, width, height)
      return request<FileResponse>(`/api/files/${id}/image`, {
        method: 'PUT',
        body: formData,
      })
    }

    return request<FileResponse>(`/api/files/${id}`, {
      method: 'PUT',
      body: {
        ...form,
        width,
        height,
        captureTime: form.captureTime || undefined,
      },
    })
  }

  return {
    updateFile,
  }
}
