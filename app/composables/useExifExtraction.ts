import type { MediaFormState } from '~/types/admin'
import exifr from 'exifr'
import { toLocalInputString } from '~/utils/datetime'
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

function normalizeToOption(
  value: string | undefined,
  options: { label: string, value: string }[],
  aliases: Record<string, string> = {},
): string {
  const normalized = value?.trim()
  if (!normalized) {
    return ''
  }
  const lower = normalized.toLowerCase()
  const alias = aliases[lower]
  if (alias) {
    return alias
  }
  const exact = options.find(option => option.value.toLowerCase() === lower)
  if (exact) {
    return exact.value
  }
  for (const [key, mapped] of Object.entries(aliases)) {
    if (lower.includes(key)) {
      return mapped
    }
  }
  const partial = options.find(option => lower.includes(option.value.toLowerCase()))
  if (partial) {
    return partial.value
  }
  return normalized
}

function formatLocation(latitude: number | undefined, longitude: number | undefined): string {
  if (latitude === undefined || longitude === undefined) {
    return ''
  }
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
}

function textFrom(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value.join(' ')
  }
  return value ?? ''
}

function formatAperture(value: number | undefined): string {
  if (!value || value <= 0) {
    return ''
  }
  return `f/${value.toFixed(1)}`
}

function formatShutter(exposureTime?: number, shutterSpeed?: number): string {
  if (exposureTime && exposureTime > 0) {
    if (exposureTime < 1) {
      return `1/${Math.round(1 / exposureTime)}s`
    }
    return `${exposureTime.toFixed(2)}s`
  }
  if (shutterSpeed !== undefined) {
    const base = 2 ** -shutterSpeed
    if (base < 1) {
      return `1/${Math.round(1 / base)}s`
    }
    return `${base.toFixed(2)}s`
  }
  return ''
}

function formatFocal(value: number | undefined): string {
  if (!value || value <= 0) {
    return ''
  }
  return `${value.toFixed(0)}mm`
}

function formatExposureBias(value: number | string | undefined): string {
  if (value === undefined || value === null) {
    return ''
  }
  const numeric = typeof value === 'string' ? Number(value) : value
  if (Number.isFinite(numeric)) {
    const rounded = Math.round(numeric * 10) / 10
    const sign = rounded > 0 ? '+' : ''
    return `${sign}${rounded.toFixed(1)} EV`
  }
  const text = String(value).trim()
  return text.length > 0 ? text : ''
}

function formatResolutionValue(value: number | string | undefined): string {
  if (value === undefined || value === null) {
    return ''
  }
  const numeric = typeof value === 'string' ? Number(value) : value
  if (Number.isFinite(numeric)) {
    if (Number.isInteger(numeric)) {
      return numeric.toString()
    }
    return numeric.toFixed(2).replace(/\.0+$/, '').replace(/0+$/, '').replace(/\.$/, '')
  }
  return String(value)
}

function formatResolutionUnit(value: number | string | undefined): string {
  if (value === undefined || value === null) {
    return ''
  }
  const numeric = typeof value === 'string' ? Number(value) : value
  if (Number.isFinite(numeric)) {
    if (numeric === 2) {
      return 'Pixels/Inch'
    }
    if (numeric === 3) {
      return 'Pixels/Centimeter'
    }
  }
  return String(value)
}

function formatColorSpace(value: number | string | undefined): string {
  if (value === undefined || value === null) {
    return ''
  }
  const numeric = typeof value === 'string' ? Number(value) : value
  if (Number.isFinite(numeric)) {
    if (numeric === 1) {
      return 'sRGB'
    }
    if (numeric === 65_535) {
      return 'Uncalibrated'
    }
  }
  const text = String(value).trim()
  return text.length > 0 ? text : ''
}

function formatDate(value: string | Date | undefined): string {
  if (!value) {
    return ''
  }
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return date.toISOString()
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

  const formatExposureProgram = (value: number | string | undefined): string => {
    if (value === undefined || value === null) {
      return ''
    }
    const map: Record<number, string> = {
      0: 'Not defined',
      1: 'Manual',
      2: 'Program',
      3: 'Aperture priority',
      4: 'Shutter priority',
      5: 'Creative',
      6: 'Action',
      7: 'Portrait',
      8: 'Landscape',
    }
    const numeric = typeof value === 'string' ? Number(value) : value
    const text = Number.isFinite(numeric) ? map[numeric] ?? `Program ${numeric}` : String(value).trim()
    return normalizeToOption(text, exposureProgramOptions.value, {
      'normal program': 'Program',
      'program normal': 'Program',
    })
  }

  const formatExposureMode = (value: number | string | undefined): string => {
    if (value === undefined || value === null) {
      return ''
    }
    const map: Record<number, string> = {
      0: 'Auto',
      1: 'Manual',
      2: 'Auto bracket',
    }
    const numeric = typeof value === 'string' ? Number(value) : value
    const text = Number.isFinite(numeric) ? map[numeric] ?? `Mode ${numeric}` : String(value).trim()
    return normalizeToOption(text, exposureModeOptions.value)
  }

  const formatMeteringMode = (value: number | string | undefined): string => {
    if (value === undefined || value === null) {
      return ''
    }
    const map: Record<number, string> = {
      0: 'Unknown',
      1: 'Average',
      2: 'Center-weighted',
      3: 'Spot',
      4: 'Multi-spot',
      5: 'Pattern',
      6: 'Partial',
      255: 'Other',
    }
    const numeric = typeof value === 'string' ? Number(value) : value
    const text = Number.isFinite(numeric) ? map[numeric] ?? `Mode ${numeric}` : String(value).trim()
    return normalizeToOption(text, meteringModeOptions.value, {
      'matrix': 'Pattern',
      'multispot': 'Multi-spot',
      'multi-spot': 'Multi-spot',
      'center-weighted average': 'Center-weighted',
    })
  }

  const formatWhiteBalance = (value: number | string | undefined): string => {
    if (value === undefined || value === null) {
      return ''
    }
    const map: Record<number, string> = {
      0: 'Auto',
      1: 'Manual',
    }
    const numeric = typeof value === 'string' ? Number(value) : value
    const text = Number.isFinite(numeric) ? map[numeric] ?? `WB ${numeric}` : String(value).trim()
    return normalizeToOption(text, whiteBalanceOptions.value)
  }

  const formatFlash = (value: number | string | undefined): string => {
    if (value === undefined || value === null) {
      return ''
    }
    const numeric = typeof value === 'string' ? Number(value) : value
    if (Number.isFinite(numeric)) {
      const fired = (numeric & 1) === 1
      const auto = (numeric & 24) === 24
      if (fired) {
        return auto ? 'Auto (fired)' : 'Fired'
      }
      return auto ? 'Auto (did not fire)' : 'Did not fire'
    }
    return normalizeToOption(String(value).trim(), flashOptions.value, {
      'did not fire': 'Did not fire',
      'auto, did not fire': 'Auto (did not fire)',
      'auto - did not fire': 'Auto (did not fire)',
      'auto, fired': 'Auto (fired)',
    })
  }

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
      const exposureProgram = formatExposureProgram(parsed.ExposureProgram)
      const exposureMode = formatExposureMode(parsed.ExposureMode)
      const meteringMode = formatMeteringMode(parsed.MeteringMode)
      const whiteBalance = formatWhiteBalance(parsed.WhiteBalance)
      const flash = formatFlash(parsed.Flash)
      const colorSpace = formatColorSpace(parsed.ColorSpace)
      const resolutionX = formatResolutionValue(parsed.XResolution)
      const resolutionY = formatResolutionValue(parsed.YResolution)
      const resolutionUnit = formatResolutionUnit(parsed.ResolutionUnit)
      const software = textFrom(parsed.Software)
      const captureTime = formatDate(parsed.DateTimeOriginal ?? parsed.CreateDate)

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
