import type { FileMetadata } from '~/types/file'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { extname, join } from 'node:path'
import { exiftool } from 'exiftool-vendored'
import { logger } from './logger'

type FocusMetadata = Pick<
  FileMetadata,
  | 'focusDistance'
  | 'focusFrameSize'
  | 'focusLocation'
  | 'focusMode'
  | 'focusPosition'
  | 'hasCrop'
  | 'cropLeft'
  | 'cropTop'
  | 'cropRight'
  | 'cropBottom'
  | 'cropAngle'
  | 'perspectiveHorizontal'
  | 'perspectiveVertical'
  | 'perspectiveRotate'
  | 'perspectiveScale'
  | 'perspectiveUpright'
  | 'uprightTransform'
  | 'lightroomRecipe'
>

const DEFAULT_FOCUS_METADATA_TIMEOUT_MS = 8000
const MIN_FOCUS_METADATA_TIMEOUT_MS = 500
const MAX_FOCUS_METADATA_TIMEOUT_MS = 60_000
const FOCUS_METADATA_BACKOFF_MS = 5 * 60 * 1000

let focusMetadataDisabledUntil = 0

function resolveFocusMetadataTimeoutMs(): number {
  const raw = process.env.FOCUS_METADATA_TIMEOUT_MS ?? process.env.NUXT_FOCUS_METADATA_TIMEOUT_MS
  const parsed = Number.parseInt(raw ?? '', 10)
  if (!Number.isFinite(parsed)) {
    return DEFAULT_FOCUS_METADATA_TIMEOUT_MS
  }
  return Math.max(MIN_FOCUS_METADATA_TIMEOUT_MS, Math.min(MAX_FOCUS_METADATA_TIMEOUT_MS, parsed))
}

function shouldBackoffFocusMetadata(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }
  const normalized = error.message.toLowerCase()
  return normalized.includes('timed out')
    || normalized.includes('enoent')
    || normalized.includes('spawn')
    || normalized.includes('exiftool')
}

function disableFocusMetadataExtraction(error: unknown): void {
  focusMetadataDisabledUntil = Date.now() + FOCUS_METADATA_BACKOFF_MS
  logger.warn('focus metadata extraction temporarily disabled', { backoffMs: FOCUS_METADATA_BACKOFF_MS, error })
}

function readFocusTagsWithTimeout(sourcePath: string, timeoutMs: number): Promise<Record<string, unknown>> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Focus metadata extraction timed out after ${timeoutMs}ms.`))
    }, timeoutMs)
  })
  const readPromise = exiftool.read(sourcePath) as Promise<Record<string, unknown>>
  return Promise.race([readPromise, timeoutPromise]).finally(() => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId)
    }
  }) as Promise<Record<string, unknown>>
}

function normalizeMetadataText(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const normalized = value.trim()
    return normalized.length > 0 ? normalized : undefined
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : undefined
  }
  if (typeof value === 'bigint' || typeof value === 'boolean') {
    return String(value)
  }
  if (Array.isArray(value)) {
    const normalized = value
      .map(entry => normalizeMetadataText(entry))
      .filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
      .join(' ')
      .trim()
    return normalized.length > 0 ? normalized : undefined
  }
  if (value && typeof value === 'object' && typeof (value as { toString?: unknown }).toString === 'function') {
    const normalized = String(value).trim()
    return normalized.length > 0 ? normalized : undefined
  }
  return undefined
}

function pickFirstTagValue(tags: Record<string, unknown>, tagNames: string[]): string | undefined {
  for (const tagName of tagNames) {
    const value = normalizeMetadataText(tags[tagName])
    if (value) {
      return value
    }
  }
  return undefined
}

function resolveUprightTransformIndex(raw: string | undefined): number | null {
  if (!raw) {
    return null
  }
  const normalized = raw.trim().toLowerCase()
  if (normalized.length === 0) {
    return null
  }
  const numeric = Number(normalized)
  if (Number.isInteger(numeric) && numeric >= 0 && numeric <= 5) {
    return numeric
  }
  const map: Record<string, number> = {
    off: 0,
    auto: 1,
    level: 2,
    vertical: 3,
    full: 4,
    guided: 5,
  }
  return map[normalized] ?? null
}

function resolveUprightTransform(tags: Record<string, unknown>, perspectiveUpright: string | undefined): string | undefined {
  const resolvedIndex = resolveUprightTransformIndex(perspectiveUpright)
  if (resolvedIndex !== null) {
    return pickFirstTagValue(tags, [`UprightTransform_${resolvedIndex}`])
  }
  return pickFirstTagValue(tags, [
    'UprightTransform_1',
    'UprightTransform_0',
    'UprightTransform_2',
    'UprightTransform_3',
    'UprightTransform_4',
    'UprightTransform_5',
  ])
}

function resolveTempExtension(filename: string | undefined): string {
  const extension = extname(filename ?? '').toLowerCase()
  if (!extension || extension.length > 10 || /[^a-z0-9.]/.test(extension)) {
    return '.img'
  }
  return extension
}

function parseTagNumber(tags: Record<string, unknown>, tagNames: string[]): number | null {
  const raw = pickFirstTagValue(tags, tagNames)
  if (!raw) {
    return null
  }
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

function isNearlyEqual(value: number, target: number, epsilon: number = 1e-3): boolean {
  return Math.abs(value - target) <= epsilon
}

function normalizeNumber(value: number, digits: number = 2): number {
  const factor = 10 ** digits
  const rounded = Math.round(value * factor) / factor
  return isNearlyEqual(rounded, 0) ? 0 : rounded
}

function hasEntries(value: Record<string, unknown>): boolean {
  return Object.keys(value).length > 0
}

function assignIfChanged(
  target: Record<string, number>,
  key: string,
  value: number | null,
  options: {
    defaultValue?: number
    digits?: number
  } = {},
): void {
  if (value === null) {
    return
  }
  const normalized = normalizeNumber(value, options.digits ?? 2)
  if (isNearlyEqual(normalized, options.defaultValue ?? 0)) {
    return
  }
  target[key] = normalized
}

interface LightroomColorAdjustments {
  hue?: number
  saturation?: number
  luminance?: number
}

type CurvePointTuple = [number, number]

interface LightroomToneCurvePayload {
  name?: string
  composite?: CurvePointTuple[]
  red?: CurvePointTuple[]
  green?: CurvePointTuple[]
  blue?: CurvePointTuple[]
}

interface LightroomColorGradingAdjustments {
  shadows?: LightroomColorAdjustments
  midtones?: LightroomColorAdjustments
  highlights?: LightroomColorAdjustments
  global?: LightroomColorAdjustments
  blending?: number
  balance?: number
}

interface LightroomRecipePayload {
  processVersion?: string
  profile?: string
  cameraLook?: string
  whiteBalance?: string
  toneCurve?: LightroomToneCurvePayload
  basic?: Record<string, number>
  hsl?: Record<string, LightroomColorAdjustments>
  colorGrading?: LightroomColorGradingAdjustments
  calibration?: Record<string, number>
}

function resolveCameraCreativeLook(tags: Record<string, unknown>): string | undefined {
  return pickFirstTagValue(tags, [
    'PictureStyle',
    'PictureStyle2',
    'PictureControlName',
    'CreativeStyle',
    'FilmMode',
    'FilmSimulation',
    'PhotoStyle',
    'PictureMode',
    'PictureEffect',
    'ColorMode',
    'ArtFilter',
    'CreativeFilter',
  ])
}

function extractNumbers(value: unknown): number[] {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? [value] : []
  }
  if (typeof value === 'string') {
    const matches = value.match(/-?\d+(?:\.\d+)?/g)
    if (!matches) {
      return []
    }
    return matches
      .map(Number)
      .filter(element => Number.isFinite(element))
  }
  if (Array.isArray(value)) {
    return value.flatMap(element => extractNumbers(element))
  }
  if (value && typeof value === 'object' && typeof (value as { toString?: unknown }).toString === 'function') {
    return extractNumbers(String(value))
  }
  return []
}

function normalizeCurvePoints(raw: unknown): CurvePointTuple[] | null {
  const numbers = extractNumbers(raw)
  if (numbers.length < 4) {
    return null
  }
  const normalized: CurvePointTuple[] = []
  const pairCount = Math.floor(numbers.length / 2)
  const max = Math.max(...numbers.map(value => Math.abs(value)))
  const scale = max <= 1.5 ? 255 : 1
  for (let index = 0; index < pairCount; index += 1) {
    const x = numbers[index * 2]
    const y = numbers[index * 2 + 1]
    if (x === undefined || y === undefined) {
      continue
    }
    const scaledX = Math.max(0, Math.min(255, x * scale))
    const scaledY = Math.max(0, Math.min(255, y * scale))
    normalized.push([normalizeNumber(scaledX, 2), normalizeNumber(scaledY, 2)])
  }
  if (normalized.length < 2) {
    return null
  }
  normalized.sort((left, right) => left[0] - right[0])
  const deduped: CurvePointTuple[] = []
  for (const point of normalized) {
    const previous = deduped.at(-1)
    if (!previous || !isNearlyEqual(previous[0], point[0])) {
      deduped.push(point)
      continue
    }
    deduped[deduped.length - 1] = point
  }
  if (deduped.length < 2) {
    return null
  }
  const first = deduped[0]
  if (first && first[0] > 0) {
    deduped.unshift([0, 0])
  }
  const last = deduped.at(-1)
  if (last && last[0] < 255) {
    deduped.push([255, 255])
  }
  return deduped
}

function isLinearCurve(points: CurvePointTuple[]): boolean {
  return points.every(([x, y]) => isNearlyEqual(x, y, 2))
}

function pickCurvePoints(tags: Record<string, unknown>, tagNames: string[]): CurvePointTuple[] | null {
  for (const tagName of tagNames) {
    const points = normalizeCurvePoints(tags[tagName])
    if (points) {
      return points
    }
  }
  return null
}

function buildToneCurvePayload(tags: Record<string, unknown>): LightroomToneCurvePayload | null {
  const name = pickFirstTagValue(tags, ['ToneCurveName2012', 'ToneCurveName'])
  const composite = pickCurvePoints(tags, ['ToneCurvePV2012', 'ToneCurve'])
  const red = pickCurvePoints(tags, ['ToneCurvePV2012Red', 'ToneCurveRed'])
  const green = pickCurvePoints(tags, ['ToneCurvePV2012Green', 'ToneCurveGreen'])
  const blue = pickCurvePoints(tags, ['ToneCurvePV2012Blue', 'ToneCurveBlue'])

  const payload: LightroomToneCurvePayload = {}
  if (name && name.toLowerCase() !== 'linear') {
    payload.name = name
  }
  if (composite && !isLinearCurve(composite)) {
    payload.composite = composite
  }
  if (red && !isLinearCurve(red)) {
    payload.red = red
  }
  if (green && !isLinearCurve(green)) {
    payload.green = green
  }
  if (blue && !isLinearCurve(blue)) {
    payload.blue = blue
  }

  return hasEntries(payload as Record<string, unknown>) ? payload : null
}

function buildColorGradingTone(tags: Record<string, unknown>, candidates: {
  hue: string[]
  saturation: string[]
  luminance: string[]
}): LightroomColorAdjustments | null {
  const hue = parseTagNumber(tags, candidates.hue)
  const saturation = parseTagNumber(tags, candidates.saturation)
  const luminance = parseTagNumber(tags, candidates.luminance)
  const tone: LightroomColorAdjustments = {}
  const normalizedSaturation = saturation === null ? null : normalizeNumber(saturation)
  const normalizedHue = hue === null ? null : normalizeNumber(hue)
  if (normalizedSaturation !== null && !isNearlyEqual(normalizedSaturation, 0)) {
    tone.saturation = normalizedSaturation
  }
  if (
    normalizedHue !== null
    && (
      !isNearlyEqual(normalizedHue, 0)
      || (normalizedSaturation !== null && !isNearlyEqual(normalizedSaturation, 0))
    )
  ) {
    tone.hue = normalizedHue
  }
  if (luminance !== null && !isNearlyEqual(luminance, 0)) {
    tone.luminance = normalizeNumber(luminance)
  }
  return hasEntries(tone as Record<string, unknown>) ? tone : null
}

function buildLightroomRecipe(tags: Record<string, unknown>): string | undefined {
  const basic: Record<string, number> = {}
  assignIfChanged(basic, 'exposure', parseTagNumber(tags, ['Exposure2012', 'Exposure']), { digits: 2 })
  assignIfChanged(basic, 'contrast', parseTagNumber(tags, ['Contrast2012', 'Contrast']), { digits: 0 })
  assignIfChanged(basic, 'highlights', parseTagNumber(tags, ['Highlights2012', 'Highlights']), { digits: 0 })
  assignIfChanged(basic, 'shadows', parseTagNumber(tags, ['Shadows2012', 'Shadows']), { digits: 0 })
  assignIfChanged(basic, 'whites', parseTagNumber(tags, ['Whites2012', 'Whites']), { digits: 0 })
  assignIfChanged(basic, 'blacks', parseTagNumber(tags, ['Blacks2012', 'Blacks']), { digits: 0 })
  assignIfChanged(basic, 'texture', parseTagNumber(tags, ['Texture', 'Texture2019']), { digits: 0 })
  assignIfChanged(basic, 'clarity', parseTagNumber(tags, ['Clarity2012', 'Clarity']), { digits: 0 })
  assignIfChanged(basic, 'dehaze', parseTagNumber(tags, ['Dehaze']), { digits: 0 })
  assignIfChanged(basic, 'vibrance', parseTagNumber(tags, ['Vibrance']), { digits: 0 })
  assignIfChanged(basic, 'saturation', parseTagNumber(tags, ['Saturation', 'Saturation2']), { digits: 0 })

  const whiteBalance = pickFirstTagValue(tags, ['WhiteBalance2', 'WhiteBalance'])
  const normalizedWhiteBalance = whiteBalance?.trim().toLowerCase() ?? ''
  const hasCustomWhiteBalance = normalizedWhiteBalance.length > 0
    && normalizedWhiteBalance !== 'as shot'
    && normalizedWhiteBalance !== 'auto'
  const temperature = parseTagNumber(tags, ['Temperature'])
  const tint = parseTagNumber(tags, ['Tint'])
  if (temperature !== null && (hasCustomWhiteBalance || (tint !== null && !isNearlyEqual(tint, 0)))) {
    basic.temperature = normalizeNumber(temperature, 0)
  }
  if (tint !== null && (hasCustomWhiteBalance || !isNearlyEqual(tint, 0))) {
    basic.tint = normalizeNumber(tint, 0)
  }

  const hsl: Record<string, LightroomColorAdjustments> = {}
  const hslColors = [
    { key: 'red', suffix: 'Red' },
    { key: 'orange', suffix: 'Orange' },
    { key: 'yellow', suffix: 'Yellow' },
    { key: 'green', suffix: 'Green' },
    { key: 'aqua', suffix: 'Aqua' },
    { key: 'blue', suffix: 'Blue' },
    { key: 'purple', suffix: 'Purple' },
    { key: 'magenta', suffix: 'Magenta' },
  ] as const
  for (const color of hslColors) {
    const adjustments: LightroomColorAdjustments = {}
    assignIfChanged(adjustments as Record<string, number>, 'hue', parseTagNumber(tags, [
      `HueAdjustment${color.suffix}`,
      `Hue${color.suffix}`,
    ]))
    assignIfChanged(adjustments as Record<string, number>, 'saturation', parseTagNumber(tags, [
      `SaturationAdjustment${color.suffix}`,
      `Saturation${color.suffix}`,
    ]))
    assignIfChanged(adjustments as Record<string, number>, 'luminance', parseTagNumber(tags, [
      `LuminanceAdjustment${color.suffix}`,
      `Luminance${color.suffix}`,
    ]))
    if (hasEntries(adjustments as Record<string, unknown>)) {
      hsl[color.key] = adjustments
    }
  }

  const colorGrading: LightroomColorGradingAdjustments = {}
  const shadows = buildColorGradingTone(tags, {
    hue: ['ColorGradeShadowHue', 'ColorGradeShadowsHue', 'SplitToningShadowHue'],
    saturation: ['ColorGradeShadowSat', 'ColorGradeShadowsSat', 'SplitToningShadowSaturation'],
    luminance: ['ColorGradeShadowLum', 'ColorGradeShadowsLum'],
  })
  const midtones = buildColorGradingTone(tags, {
    hue: ['ColorGradeMidtoneHue', 'ColorGradeMidtonesHue'],
    saturation: ['ColorGradeMidtoneSat', 'ColorGradeMidtonesSat'],
    luminance: ['ColorGradeMidtoneLum', 'ColorGradeMidtonesLum'],
  })
  const highlights = buildColorGradingTone(tags, {
    hue: ['ColorGradeHighlightHue', 'ColorGradeHighlightsHue', 'SplitToningHighlightHue'],
    saturation: ['ColorGradeHighlightSat', 'ColorGradeHighlightsSat', 'SplitToningHighlightSaturation'],
    luminance: ['ColorGradeHighlightLum', 'ColorGradeHighlightsLum'],
  })
  const global = buildColorGradingTone(tags, {
    hue: ['ColorGradeGlobalHue'],
    saturation: ['ColorGradeGlobalSat'],
    luminance: ['ColorGradeGlobalLum'],
  })
  if (shadows) {
    colorGrading.shadows = shadows
  }
  if (midtones) {
    colorGrading.midtones = midtones
  }
  if (highlights) {
    colorGrading.highlights = highlights
  }
  if (global) {
    colorGrading.global = global
  }
  const blending = parseTagNumber(tags, ['ColorGradeBlending'])
  if (blending !== null && !isNearlyEqual(blending, 50)) {
    colorGrading.blending = normalizeNumber(blending)
  }
  const balance = parseTagNumber(tags, ['ColorGradeBalance', 'SplitToningBalance'])
  if (balance !== null && !isNearlyEqual(balance, 0)) {
    colorGrading.balance = normalizeNumber(balance)
  }

  const calibration: Record<string, number> = {}
  assignIfChanged(calibration, 'shadowTint', parseTagNumber(tags, ['ShadowTint']), { digits: 0 })
  assignIfChanged(calibration, 'redPrimaryHue', parseTagNumber(tags, ['RedPrimaryHue', 'RedHue']), { digits: 0 })
  assignIfChanged(calibration, 'redPrimarySaturation', parseTagNumber(tags, ['RedPrimarySaturation', 'RedSaturation']), { digits: 0 })
  assignIfChanged(calibration, 'greenPrimaryHue', parseTagNumber(tags, ['GreenPrimaryHue', 'GreenHue']), { digits: 0 })
  assignIfChanged(calibration, 'greenPrimarySaturation', parseTagNumber(tags, ['GreenPrimarySaturation', 'GreenSaturation']), { digits: 0 })
  assignIfChanged(calibration, 'bluePrimaryHue', parseTagNumber(tags, ['BluePrimaryHue', 'BlueHue']), { digits: 0 })
  assignIfChanged(calibration, 'bluePrimarySaturation', parseTagNumber(tags, ['BluePrimarySaturation', 'BlueSaturation']), { digits: 0 })

  const hasBasic = hasEntries(basic)
  const hasHsl = hasEntries(hsl as Record<string, unknown>)
  const hasColorGrading = hasEntries(colorGrading as Record<string, unknown>)
  const hasCalibration = hasEntries(calibration)
  const toneCurve = buildToneCurvePayload(tags)
  const profile = pickFirstTagValue(tags, ['Profile', 'CameraProfile', 'Look'])
  const cameraLook = resolveCameraCreativeLook(tags)
  const hasLookInfo = Boolean(profile || cameraLook)
  if (!hasBasic && !hasHsl && !hasColorGrading && !hasCalibration && !toneCurve && !hasLookInfo) {
    return undefined
  }

  const payload: LightroomRecipePayload = {
    processVersion: pickFirstTagValue(tags, ['ProcessVersion']),
    profile,
    cameraLook,
    whiteBalance: hasCustomWhiteBalance ? whiteBalance : undefined,
    toneCurve: toneCurve ?? undefined,
    basic: hasBasic ? basic : undefined,
    hsl: hasHsl ? hsl : undefined,
    colorGrading: hasColorGrading ? colorGrading : undefined,
    calibration: hasCalibration ? calibration : undefined,
  }

  return JSON.stringify(payload)
}

export async function extractFocusMetadataFromBuffer(buffer: Buffer, filename: string | undefined): Promise<FocusMetadata> {
  if (Date.now() < focusMetadataDisabledUntil) {
    return {}
  }

  const timeoutMs = resolveFocusMetadataTimeoutMs()
  const workspace = await mkdtemp(join(tmpdir(), 'liora-focus-'))
  const sourcePath = join(workspace, `source${resolveTempExtension(filename)}`)
  try {
    await writeFile(sourcePath, buffer)
    const tags = await readFocusTagsWithTimeout(sourcePath, timeoutMs)
    const perspectiveUpright = pickFirstTagValue(tags, ['PerspectiveUpright'])
    return {
      focusDistance: pickFirstTagValue(tags, ['FocusDistance2', 'FocusDistance', 'SubjectDistance']),
      focusFrameSize: pickFirstTagValue(tags, ['FocusFrameSize']),
      focusLocation: pickFirstTagValue(tags, ['FocusLocation']),
      focusMode: pickFirstTagValue(tags, ['FocusMode']),
      focusPosition: pickFirstTagValue(tags, ['FocusPosition2', 'FocusPosition']),
      hasCrop: pickFirstTagValue(tags, ['HasCrop']),
      cropLeft: pickFirstTagValue(tags, ['CropLeft']),
      cropTop: pickFirstTagValue(tags, ['CropTop']),
      cropRight: pickFirstTagValue(tags, ['CropRight']),
      cropBottom: pickFirstTagValue(tags, ['CropBottom']),
      cropAngle: pickFirstTagValue(tags, ['CropAngle']),
      perspectiveHorizontal: pickFirstTagValue(tags, ['PerspectiveHorizontal']),
      perspectiveVertical: pickFirstTagValue(tags, ['PerspectiveVertical']),
      perspectiveRotate: pickFirstTagValue(tags, ['PerspectiveRotate']),
      perspectiveScale: pickFirstTagValue(tags, ['PerspectiveScale']),
      perspectiveUpright,
      uprightTransform: resolveUprightTransform(tags, perspectiveUpright),
      lightroomRecipe: buildLightroomRecipe(tags),
    }
  }
  catch (error) {
    if (shouldBackoffFocusMetadata(error)) {
      disableFocusMetadataExtraction(error)
    }
    logger.warn('focus metadata extraction failed', { error })
    return {}
  }
  finally {
    await rm(workspace, { recursive: true, force: true })
  }
}
