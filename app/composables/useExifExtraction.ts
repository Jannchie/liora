import type { MediaFormState } from '~/types/admin'
import exifr from 'exifr'
import { toLocalInputString } from '~/utils/datetime'
import {
  formatAperture,
  formatCaptureTime,
  formatColorSpace,
  formatExposureBias,
  formatFocal,
  formatLocation,
  formatResolutionUnit,
  formatResolutionValue,
  formatShutter,
  normalizeToOption,
  textFrom,
} from '~/utils/exif-format'
import {
  normalizeExposureModeValue,
  normalizeExposureProgramValue,
  normalizeFlashValue,
  normalizeMeteringModeValue,
  normalizeWhiteBalanceValue,
} from '~/utils/exposure'
import { useExposureOptions } from './useExposureOptions'

interface ExifData {
  Make?: string
  Model?: string
  ImageDescription?: string
  XPComment?: string | string[]
  XPKeywords?: string[]
  FNumber?: number
  ExposureTime?: number
  ShutterSpeedValue?: number
  FocalLength?: number
  ISO?: number
  LensModel?: string
  DateTimeOriginal?: string | Date
  CreateDate?: string | Date
  latitude?: number
  longitude?: number
  ExposureBiasValue?: number | string
  ExposureCompensation?: number | string
  ExposureProgram?: number | string
  ExposureMode?: number | string
  MeteringMode?: number | string
  WhiteBalance?: number | string
  Flash?: number | string
  ColorSpace?: number | string
  XResolution?: number | string
  YResolution?: number | string
  ResolutionUnit?: number | string
  Software?: string | string[]
}

export function useExifExtraction(): {
  extractExif: (params: {
    file: File
    token: number
    isActiveToken: (token: number) => boolean
    form: MediaFormState
    captureTimeLocal: { value: string }
    exifFailedFallback: string
  }) => Promise<{ errorMessage?: string }>
} {
  const {
    exposureProgramOptions,
    exposureModeOptions,
    meteringModeOptions,
    whiteBalanceOptions,
    flashOptions,
  } = useExposureOptions()

  const extractExif = async (params: {
    file: File
    token: number
    isActiveToken: (token: number) => boolean
    form: MediaFormState
    captureTimeLocal: { value: string }
    exifFailedFallback: string
  }): Promise<{ errorMessage?: string }> => {
    const { file, token, isActiveToken, form, captureTimeLocal, exifFailedFallback } = params
    try {
      const parsed = (await exifr.parse(file, [
        'Make',
        'Model',
        'ImageDescription',
        'XPComment',
        'XPKeywords',
        'FNumber',
        'ExposureTime',
        'ShutterSpeedValue',
        'FocalLength',
        'ISO',
        'LensModel',
        'DateTimeOriginal',
        'CreateDate',
        'latitude',
        'longitude',
        'GPSLatitude',
        'GPSLatitudeRef',
        'GPSLongitude',
        'GPSLongitudeRef',
        'ExposureBiasValue',
        'ExposureCompensation',
        'ExposureProgram',
        'ExposureMode',
        'MeteringMode',
        'WhiteBalance',
        'Flash',
        'ColorSpace',
        'XResolution',
        'YResolution',
        'ResolutionUnit',
        'Software',
      ])) as ExifData | undefined

      if (!parsed || !isActiveToken(token)) {
        return {}
      }

      const model = [parsed.Make, parsed.Model].filter(Boolean).join(' ').trim()
      const lens = parsed.LensModel ?? ''
      const locationText = formatLocation(parsed.latitude, parsed.longitude)
      const description = textFrom(parsed.ImageDescription ?? parsed.XPComment ?? textFrom(parsed.XPKeywords))
      const aperture = formatAperture(parsed.FNumber)
      const shutter = formatShutter(parsed.ExposureTime, parsed.ShutterSpeedValue)
      const focal = formatFocal(parsed.FocalLength)
      const iso = parsed.ISO ? String(parsed.ISO) : ''
      const exposureBias = formatExposureBias(parsed.ExposureBiasValue ?? parsed.ExposureCompensation)
      const exposureProgram = normalizeToOption(normalizeExposureProgramValue(parsed.ExposureProgram), exposureProgramOptions.value)
      const exposureMode = normalizeToOption(normalizeExposureModeValue(parsed.ExposureMode), exposureModeOptions.value)
      const meteringMode = normalizeToOption(normalizeMeteringModeValue(parsed.MeteringMode), meteringModeOptions.value)
      const whiteBalance = normalizeToOption(normalizeWhiteBalanceValue(parsed.WhiteBalance), whiteBalanceOptions.value)
      const flash = normalizeToOption(normalizeFlashValue(parsed.Flash), flashOptions.value)
      const colorSpace = formatColorSpace(parsed.ColorSpace)
      const resolutionX = formatResolutionValue(parsed.XResolution)
      const resolutionY = formatResolutionValue(parsed.YResolution)
      const resolutionUnit = formatResolutionUnit(parsed.ResolutionUnit)
      const software = textFrom(parsed.Software)
      const captureTime = formatCaptureTime(parsed.DateTimeOriginal ?? parsed.CreateDate)

      if (!isActiveToken(token)) {
        return {}
      }

      if (model) {
        form.cameraModel = model
      }
      if (lens) {
        form.lensModel = lens
      }
      if (locationText) {
        form.location = locationText
        form.locationName = locationText
      }
      if (description && !form.description) {
        form.description = description
      }
      if (aperture) {
        form.aperture = aperture
      }
      if (shutter) {
        form.shutterSpeed = shutter
      }
      if (focal) {
        form.focalLength = focal
      }
      if (iso) {
        form.iso = iso
      }
      if (exposureBias) {
        form.exposureBias = exposureBias
      }
      if (exposureProgram) {
        form.exposureProgram = exposureProgram
      }
      if (exposureMode) {
        form.exposureMode = exposureMode
      }
      if (meteringMode) {
        form.meteringMode = meteringMode
      }
      if (whiteBalance) {
        form.whiteBalance = whiteBalance
      }
      if (flash) {
        form.flash = flash
      }
      if (colorSpace) {
        form.colorSpace = colorSpace
      }
      if (resolutionX) {
        form.resolutionX = resolutionX
      }
      if (resolutionY) {
        form.resolutionY = resolutionY
      }
      if (resolutionUnit) {
        form.resolutionUnit = resolutionUnit
      }
      if (software) {
        form.software = software
      }
      if (captureTime) {
        form.captureTime = captureTime
        captureTimeLocal.value = toLocalInputString(captureTime)
      }
      return {}
    }
    catch (error) {
      return { errorMessage: error instanceof Error ? error.message : exifFailedFallback }
    }
  }

  return { extractExif }
}
