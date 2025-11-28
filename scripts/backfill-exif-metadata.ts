import type { FileMetadata } from '../app/types/file'
import { join } from 'node:path'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import exifr from 'exifr'
import { PrismaClient } from '../app/generated/prisma/client'

function escapeRegExp(value: string): string {
  return value.replaceAll(/[-/\\^$*+?.()|[\]{}]/g, String.raw`\\$&`)
}

function stripLensFromCamera(cameraModel: string, lensModel: string): { cameraModel: string, lensModel: string } {
  // eslint-disable-next-line unicorn/consistent-function-scoping
  const normalizeSpaces = (value: string): string => value.replaceAll(/\s+/g, ' ').trim()
  const separators = ['·', '|', '/', '-', '—', '–', '+', ',']
  const separatorClass = `[${separators.map(element => escapeRegExp(element)).join('')}]`

  const camera = normalizeSpaces(cameraModel)
  const lens = normalizeSpaces(lensModel)

  const tryRemoveExplicitLens = (): { cameraModel: string, lensModel: string } | null => {
    if (!lens) {
      return null
    }
    const lowerCamera = camera.toLowerCase()
    const lowerLens = lens.toLowerCase()
    const lensIndex = lowerCamera.lastIndexOf(lowerLens)
    if (lensIndex === -1) {
      return null
    }
    const beforeLens = camera.slice(0, lensIndex).replace(new RegExp(`\\s*${separatorClass}\\s*$`, 'u'), '')
    const afterLens = camera.slice(lensIndex + lens.length).replace(new RegExp(`^${separatorClass}\\s*`, 'u'), '')
    const cleaned = `${beforeLens} ${afterLens}`.trim().replace(new RegExp(`${separatorClass}+$`, 'u'), '').trim()
    return { cameraModel: cleaned.length > 0 ? cleaned : camera, lensModel: lens }
  }

  const explicit = tryRemoveExplicitLens()
  if (explicit) {
    return explicit
  }

  if (!lens) {
    for (const separator of separators) {
      const index = camera.lastIndexOf(separator)
      if (index > 0 && index < camera.length - 2) {
        const base = normalizeSpaces(camera.slice(0, index))
        const extracted = normalizeSpaces(camera.slice(index + 1))
        if (base.length > 0 && extracted.length > 0) {
          return { cameraModel: base, lensModel: extracted }
        }
      }
    }
  }
  const dashIndex = camera.lastIndexOf(' - ')
  if (!lens && dashIndex > 0 && dashIndex < camera.length - 3) {
    const base = normalizeSpaces(camera.slice(0, dashIndex))
    const extracted = normalizeSpaces(camera.slice(dashIndex + 3))
    if (base.length > 0 && extracted.length > 0) {
      return { cameraModel: base, lensModel: extracted }
    }
  }

  return { cameraModel: camera, lensModel: lens }
}

interface ParsedMetadata extends Partial<FileMetadata> {
  [key: string]: unknown
}

interface ExifResult {
  make?: string
  model?: string
  lensModel?: string
  exposureTime?: number
  shutterSpeedValue?: number
  fNumber?: number
  iso?: number
  focalLength?: number
  exposureBias?: number | string
  exposureCompensation?: number | string
  exposureProgram?: number | string
  exposureMode?: number | string
  meteringMode?: number | string
  whiteBalance?: number | string
  flash?: number | string
  colorSpace?: number | string
  xResolution?: number | string
  yResolution?: number | string
  resolutionUnit?: number | string
  software?: string | string[]
  dateTimeOriginal?: string | Date
  createDate?: string | Date
  latitude?: number
  longitude?: number
  imageDescription?: string | string[]
  xpComment?: string | string[]
  xpKeywords?: string | string[]
}

const databaseUrl = process.env.DATABASE_URL ?? `file:${join(process.cwd(), 'prisma', 'data.db')}`
const adapter = new PrismaLibSql({ url: databaseUrl })
const prisma = new PrismaClient({ adapter })

function parseMetadata(raw: string): ParsedMetadata {
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      return parsed as ParsedMetadata
    }
  }
  catch {
    // ignore
  }
  return {}
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

function normalizeToOption(value: string | undefined, options: string[], aliases: Record<string, string> = {}): string {
  const normalized = value?.trim()
  if (!normalized) {
    return ''
  }
  const lower = normalized.toLowerCase()
  const alias = aliases[lower]
  if (alias) {
    return alias
  }
  const exact = options.find(option => option.toLowerCase() === lower)
  if (exact) {
    return exact
  }
  for (const [key, mapped] of Object.entries(aliases)) {
    if (lower.includes(key)) {
      return mapped
    }
  }
  const partial = options.find(option => lower.includes(option.toLowerCase()))
  if (partial) {
    return partial
  }
  return normalized
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

function formatExposureProgram(value: number | string | undefined): string {
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
  if (value === undefined || value === null) {
    return ''
  }
  const numeric = typeof value === 'string' ? Number(value) : value
  const text = Number.isFinite(numeric) ? map[numeric] ?? `Program ${numeric}` : String(value).trim()
  return normalizeToOption(text, Object.values(map), {
    'normal program': 'Program',
    'program normal': 'Program',
  })
}

function formatExposureMode(value: number | string | undefined): string {
  const map: Record<number, string> = {
    0: 'Auto',
    1: 'Manual',
    2: 'Auto bracket',
  }
  if (value === undefined || value === null) {
    return ''
  }
  const numeric = typeof value === 'string' ? Number(value) : value
  const text = Number.isFinite(numeric) ? map[numeric] ?? `Mode ${numeric}` : String(value).trim()
  return normalizeToOption(text, Object.values(map))
}

function formatMeteringMode(value: number | string | undefined): string {
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
  if (value === undefined || value === null) {
    return ''
  }
  const numeric = typeof value === 'string' ? Number(value) : value
  const text = Number.isFinite(numeric) ? map[numeric] ?? `Mode ${numeric}` : String(value).trim()
  return normalizeToOption(text, Object.values(map), {
    'matrix': 'Pattern',
    'multispot': 'Multi-spot',
    'multi-spot': 'Multi-spot',
    'center-weighted average': 'Center-weighted',
  })
}

function formatWhiteBalance(value: number | string | undefined): string {
  const map: Record<number, string> = {
    0: 'Auto',
    1: 'Manual',
  }
  if (value === undefined || value === null) {
    return ''
  }
  const numeric = typeof value === 'string' ? Number(value) : value
  const text = Number.isFinite(numeric) ? map[numeric] ?? `WB ${numeric}` : String(value).trim()
  return normalizeToOption(text, Object.values(map))
}

function formatFlash(value: number | string | undefined): string {
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
  const text = String(value).trim()
  return normalizeToOption(text, ['Did not fire', 'Auto (did not fire)', 'Fired', 'Auto (fired)'], {
    'did not fire': 'Did not fire',
    'auto, did not fire': 'Auto (did not fire)',
    'auto - did not fire': 'Auto (did not fire)',
    'auto, fired': 'Auto (fired)',
  })
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

function formatCaptureTime(value: string | Date | undefined): string {
  if (!value) {
    return ''
  }
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return date.toISOString()
}

function formatLocation(latitude: number | undefined, longitude: number | undefined): string {
  if (latitude === undefined || longitude === undefined) {
    return ''
  }
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
}

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      console.warn(`Skip ${url}: HTTP ${response.status}`)
      return null
    }
    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }
  catch (error) {
    console.warn(`Skip ${url}: ${String(error)}`)
    return null
  }
}

async function readExif(buffer: Buffer): Promise<ExifResult | null> {
  try {
    const parsed = await exifr.parse(buffer, {
      reviveValues: true,
      tiff: true,
      ifd1: true,
      exif: true,
      gps: true,
      translateValues: false,
      pick: [
        'Make',
        'Model',
        'LensModel',
        'ExposureTime',
        'ShutterSpeedValue',
        'FNumber',
        'ISO',
        'FocalLength',
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
        'DateTimeOriginal',
        'CreateDate',
        'latitude',
        'longitude',
        'ImageDescription',
        'XPComment',
        'XPKeywords',
      ],
    })
    if (!parsed) {
      return null
    }
    return {
      make: parsed.Make,
      model: parsed.Model,
      lensModel: parsed.LensModel,
      exposureTime: parsed.ExposureTime,
      shutterSpeedValue: parsed.ShutterSpeedValue,
      fNumber: parsed.FNumber,
      iso: parsed.ISO,
      focalLength: parsed.FocalLength,
      exposureBias: parsed.ExposureBiasValue,
      exposureCompensation: parsed.ExposureCompensation,
      exposureProgram: parsed.ExposureProgram,
      exposureMode: parsed.ExposureMode,
      meteringMode: parsed.MeteringMode,
      whiteBalance: parsed.WhiteBalance,
      flash: parsed.Flash,
      colorSpace: parsed.ColorSpace,
      xResolution: parsed.XResolution,
      yResolution: parsed.YResolution,
      resolutionUnit: parsed.ResolutionUnit,
      software: parsed.Software,
      dateTimeOriginal: parsed.DateTimeOriginal,
      createDate: parsed.CreateDate,
      latitude: parsed.latitude,
      longitude: parsed.longitude,
      imageDescription: parsed.ImageDescription,
      xpComment: parsed.XPComment,
      xpKeywords: parsed.XPKeywords,
    }
  }
  catch (error) {
    console.warn('Failed to read EXIF:', error)
    return null
  }
}

interface MergeResult {
  metadata: ParsedMetadata
  cameraModel: string | null
}

function mergeMetadata(existing: ParsedMetadata, exif: ExifResult): MergeResult {
  const merged = { ...existing }

  const descriptionSource = [exif.imageDescription, exif.xpComment, exif.xpKeywords]
    .flatMap(value => (Array.isArray(value) ? value : [value]))
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
  if (!merged.notes && descriptionSource.length > 0) {
    merged.notes = descriptionSource.join(' ')
  }

  const cameraParts = [exif.make, exif.model].filter(Boolean).map(value => String(value).trim()).filter(value => value.length > 0)
  if (!merged.cameraModel && cameraParts.length > 0) {
    merged.cameraModel = cameraParts.join(' ')
  }
  if (!merged.lensModel && exif.lensModel) {
    merged.lensModel = String(exif.lensModel).trim()
  }
  if (merged.cameraModel && merged.lensModel) {
    const deduped = stripLensFromCamera(merged.cameraModel, merged.lensModel)
    merged.cameraModel = deduped.cameraModel
    merged.lensModel = deduped.lensModel
  }
  const normalizedCamera = merged.cameraModel && merged.cameraModel.trim().length > 0 ? merged.cameraModel : null

  const aperture = formatAperture(exif.fNumber)
  if (!merged.aperture && aperture) {
    merged.aperture = aperture
  }

  const shutter = formatShutter(exif.exposureTime, exif.shutterSpeedValue)
  if (!merged.shutterSpeed && shutter) {
    merged.shutterSpeed = shutter
  }

  const focal = formatFocal(exif.focalLength)
  if (!merged.focalLength && focal) {
    merged.focalLength = focal
  }

  if (!merged.iso && exif.iso) {
    merged.iso = String(exif.iso)
  }

  const exposureBias = formatExposureBias(exif.exposureBias ?? exif.exposureCompensation)
  if (!merged.exposureBias && exposureBias) {
    merged.exposureBias = exposureBias
  }

  const exposureProgram = formatExposureProgram(exif.exposureProgram)
  if (!merged.exposureProgram && exposureProgram) {
    merged.exposureProgram = exposureProgram
  }

  const exposureMode = formatExposureMode(exif.exposureMode)
  if (!merged.exposureMode && exposureMode) {
    merged.exposureMode = exposureMode
  }

  const meteringMode = formatMeteringMode(exif.meteringMode)
  if (!merged.meteringMode && meteringMode) {
    merged.meteringMode = meteringMode
  }

  const whiteBalance = formatWhiteBalance(exif.whiteBalance)
  if (!merged.whiteBalance && whiteBalance) {
    merged.whiteBalance = whiteBalance
  }

  const flash = formatFlash(exif.flash)
  if (!merged.flash && flash) {
    merged.flash = flash
  }

  const colorSpace = formatColorSpace(exif.colorSpace)
  if (!merged.colorSpace && colorSpace) {
    merged.colorSpace = colorSpace
  }

  const resolutionX = formatResolutionValue(exif.xResolution)
  if (!merged.resolutionX && resolutionX) {
    merged.resolutionX = resolutionX
  }
  const resolutionY = formatResolutionValue(exif.yResolution)
  if (!merged.resolutionY && resolutionY) {
    merged.resolutionY = resolutionY
  }
  const resolutionUnit = formatResolutionUnit(exif.resolutionUnit)
  if (!merged.resolutionUnit && resolutionUnit) {
    merged.resolutionUnit = resolutionUnit
  }

  const software = Array.isArray(exif.software) ? exif.software.join(' ') : exif.software
  if (!merged.software && software) {
    merged.software = String(software).trim()
  }

  const captureTime = formatCaptureTime(exif.dateTimeOriginal ?? exif.createDate)
  if (!merged.captureTime && captureTime) {
    merged.captureTime = captureTime
  }

  if (merged.latitude === undefined || merged.latitude === null) {
    merged.latitude = exif.latitude ?? null
  }
  if (merged.longitude === undefined || merged.longitude === null) {
    merged.longitude = exif.longitude ?? null
  }
  const locationText = formatLocation(exif.latitude, exif.longitude)
  if (!merged.location && locationText) {
    merged.location = locationText
  }
  if (!merged.locationName && locationText) {
    merged.locationName = locationText
  }

  return { metadata: merged, cameraModel: normalizedCamera }
}

async function main(): Promise<void> {
  const files = await prisma.file.findMany({ orderBy: { id: 'asc' } })

  let updated = 0
  let skipped = 0

  for (const file of files) {
    const sourceUrl = (file.imageUrl?.trim() || file.thumbnailUrl?.trim() || '').trim()
    if (!sourceUrl) {
      console.warn(`File #${file.id} has no image url; skip`)
      skipped += 1
      continue
    }

    const buffer = await fetchImageBuffer(sourceUrl)
    if (!buffer) {
      skipped += 1
      continue
    }

    const existingMetadata = parseMetadata(file.metadata)
    const exif = await readExif(buffer)
    const mergeResult = exif ? mergeMetadata(existingMetadata, exif) : { metadata: { ...existingMetadata }, cameraModel: null }
    const mergedMetadata = mergeResult.metadata
    if (!mergedMetadata.fileSize || Number(mergedMetadata.fileSize) <= 0) {
      mergedMetadata.fileSize = buffer.length
    }
    const dedupedCamera = mergeResult.cameraModel

    const data: Record<string, unknown> = {
      metadata: JSON.stringify(mergedMetadata),
    }

    if (dedupedCamera && dedupedCamera !== file.cameraModel) {
      data.cameraModel = dedupedCamera
    }
    if (mergedMetadata.aperture && (!file.aperture || file.aperture.trim().length === 0)) {
      data.aperture = mergedMetadata.aperture
    }
    if (mergedMetadata.focalLength && (!file.focalLength || file.focalLength.trim().length === 0)) {
      data.focalLength = mergedMetadata.focalLength
    }
    if (mergedMetadata.iso && (!file.iso || file.iso.trim().length === 0)) {
      data.iso = mergedMetadata.iso
    }
    if (mergedMetadata.shutterSpeed && (!file.shutterSpeed || file.shutterSpeed.trim().length === 0)) {
      data.shutterSpeed = mergedMetadata.shutterSpeed
    }
    if (mergedMetadata.captureTime && (!file.captureTime || file.captureTime.trim().length === 0)) {
      data.captureTime = mergedMetadata.captureTime
    }
    if (mergedMetadata.location && (!file.location || file.location.trim().length === 0)) {
      data.location = mergedMetadata.location
    }
    if (mergedMetadata.locationName && (!file.locationName || file.locationName.trim().length === 0)) {
      data.locationName = mergedMetadata.locationName
    }
    if (mergedMetadata.latitude !== undefined && mergedMetadata.latitude !== null && file.latitude === null) {
      data.latitude = mergedMetadata.latitude
    }
    if (mergedMetadata.longitude !== undefined && mergedMetadata.longitude !== null && file.longitude === null) {
      data.longitude = mergedMetadata.longitude
    }

    await prisma.file.update({
      where: { id: file.id },
      data,
    })
    updated += 1
    console.log(`Updated #${file.id} (${file.title || 'untitled'})`)
  }

  console.log(`Done. Updated ${updated}, skipped ${skipped}.`)
}

try {
  await main()
}
catch (error) {
  console.error('Backfill failed:', error)
  process.exitCode = 1
}
finally {
  await prisma.$disconnect()
}
