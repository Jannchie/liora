import type {
  LightroomRecipeView,
  RecipeAdjustmentGroup,
  RecipeAdjustmentItem,
} from '~/types/gallery'
import {
  asObject,
  createRecipeItem,
  parseCurvePoints,
  parseRecipeText,
  toDisplayText,
} from './recipe-fields'

// Pure parsing of the `lightroomRecipe` metadata field into a view model.
// Extracted from WaterfallGallery.vue so it can be unit tested in isolation.
// Accepts both the structured JSON payload and the legacy "·"-delimited token
// string. All field access is defensively guarded, so malformed input simply
// yields `null` or omits the offending field.

interface LightroomColorAdjustmentsPayload {
  hue?: unknown
  saturation?: unknown
  luminance?: unknown
}

interface LightroomToneCurvePayload {
  name?: unknown
  composite?: unknown
  red?: unknown
  green?: unknown
  blue?: unknown
}

interface LightroomRecipePayload {
  processVersion?: unknown
  profile?: unknown
  cameraLook?: unknown
  whiteBalance?: unknown
  toneCurve?: unknown
  basic?: unknown
  hsl?: unknown
  colorGrading?: unknown
  calibration?: unknown
}

function parseToneCurvePayload(source: unknown): LightroomRecipeView['toneCurve'] | undefined {
  const text = parseRecipeText(source)
  if (text) {
    return { name: text }
  }
  const payload = asObject(source) as LightroomToneCurvePayload | null
  if (!payload) {
    return undefined
  }
  const toneCurve: NonNullable<LightroomRecipeView['toneCurve']> = {}
  const name = parseRecipeText(payload.name)
  if (name) {
    toneCurve.name = name
  }
  const composite = parseCurvePoints(payload.composite)
  if (composite.length > 0) {
    toneCurve.composite = composite
  }
  const red = parseCurvePoints(payload.red)
  if (red.length > 0) {
    toneCurve.red = red
  }
  const green = parseCurvePoints(payload.green)
  if (green.length > 0) {
    toneCurve.green = green
  }
  const blue = parseCurvePoints(payload.blue)
  if (blue.length > 0) {
    toneCurve.blue = blue
  }
  const hasCurveData = toneCurve.composite || toneCurve.red || toneCurve.green || toneCurve.blue || toneCurve.name
  return hasCurveData ? toneCurve : undefined
}

function buildHslItems(hslPayload: Record<string, unknown>): RecipeAdjustmentItem[] {
  const colorMap = [
    { key: 'red', label: 'Red' },
    { key: 'orange', label: 'Orange' },
    { key: 'yellow', label: 'Yellow' },
    { key: 'green', label: 'Green' },
    { key: 'aqua', label: 'Aqua' },
    { key: 'blue', label: 'Blue' },
    { key: 'purple', label: 'Purple' },
    { key: 'magenta', label: 'Magenta' },
  ] as const
  const items: RecipeAdjustmentItem[] = []
  for (const color of colorMap) {
    const payload = asObject(hslPayload[color.key]) as LightroomColorAdjustmentsPayload | null
    if (!payload) {
      continue
    }
    const hue = createRecipeItem({
      key: `${color.key}-hue`,
      label: `${color.label} Hue`,
      source: payload.hue,
      min: -100,
      max: 100,
      digits: 0,
    })
    const saturation = createRecipeItem({
      key: `${color.key}-saturation`,
      label: `${color.label} Sat`,
      source: payload.saturation,
      min: -100,
      max: 100,
      digits: 0,
    })
    const luminance = createRecipeItem({
      key: `${color.key}-luminance`,
      label: `${color.label} Lum`,
      source: payload.luminance,
      min: -100,
      max: 100,
      digits: 0,
    })
    if (hue) {
      items.push(hue)
    }
    if (saturation) {
      items.push(saturation)
    }
    if (luminance) {
      items.push(luminance)
    }
  }
  return items
}

function buildColorGradingItems(payload: Record<string, unknown>): RecipeAdjustmentItem[] {
  const items: RecipeAdjustmentItem[] = []
  const toneMap = [
    { key: 'shadows', label: 'Shadows' },
    { key: 'midtones', label: 'Midtones' },
    { key: 'highlights', label: 'Highlights' },
    { key: 'global', label: 'Global' },
  ] as const
  for (const tone of toneMap) {
    const tonePayload = asObject(payload[tone.key]) as LightroomColorAdjustmentsPayload | null
    if (!tonePayload) {
      continue
    }
    const hue = createRecipeItem({
      key: `${tone.key}-hue`,
      label: `${tone.label} Hue`,
      source: tonePayload.hue,
      min: 0,
      max: 360,
      digits: 0,
      zeroCentered: false,
    })
    const saturation = createRecipeItem({
      key: `${tone.key}-saturation`,
      label: `${tone.label} Sat`,
      source: tonePayload.saturation,
      min: 0,
      max: 100,
      digits: 0,
      zeroCentered: false,
    })
    const luminance = createRecipeItem({
      key: `${tone.key}-luminance`,
      label: `${tone.label} Lum`,
      source: tonePayload.luminance,
      min: -100,
      max: 100,
      digits: 0,
    })
    if (hue) {
      items.push(hue)
    }
    if (saturation) {
      items.push(saturation)
    }
    if (luminance) {
      items.push(luminance)
    }
  }
  const blending = createRecipeItem({
    key: 'color-grading-blending',
    label: 'Blending',
    source: payload.blending,
    min: 0,
    max: 100,
    digits: 0,
    defaultValue: 50,
    zeroCentered: false,
  })
  const balance = createRecipeItem({
    key: 'color-grading-balance',
    label: 'Balance',
    source: payload.balance,
    min: -100,
    max: 100,
    digits: 0,
  })
  if (blending) {
    items.push(blending)
  }
  if (balance) {
    items.push(balance)
  }
  return items
}

function buildCalibrationItems(payload: Record<string, unknown>): RecipeAdjustmentItem[] {
  const items: RecipeAdjustmentItem[] = []
  const configs = [
    { key: 'shadowTint', label: 'Shadow Tint' },
    { key: 'redPrimaryHue', label: 'Red Primary Hue' },
    { key: 'redPrimarySaturation', label: 'Red Primary Sat' },
    { key: 'greenPrimaryHue', label: 'Green Primary Hue' },
    { key: 'greenPrimarySaturation', label: 'Green Primary Sat' },
    { key: 'bluePrimaryHue', label: 'Blue Primary Hue' },
    { key: 'bluePrimarySaturation', label: 'Blue Primary Sat' },
  ] as const
  for (const config of configs) {
    const item = createRecipeItem({
      key: config.key,
      label: config.label,
      source: payload[config.key],
      min: -100,
      max: 100,
      digits: 0,
    })
    if (item) {
      items.push(item)
    }
  }
  return items
}

function parseLegacyLightroomRecipeView(text: string): LightroomRecipeView | null {
  const tokens = text
    .split('·')
    .map(part => part.trim())
    .filter(part => part.length > 0)
  if (tokens.length === 0) {
    return null
  }
  const basicPayload: Record<string, number> = {}
  let processVersion: string | undefined
  let profile: string | undefined
  let whiteBalance: string | undefined
  let toneCurveName: string | undefined
  for (const token of tokens) {
    if (token.startsWith('PV ')) {
      processVersion = token.slice(3).trim()
      continue
    }
    if (token.startsWith('Profile ')) {
      profile = token.slice(8).trim()
      continue
    }
    if (token.startsWith('WB ')) {
      whiteBalance = token.slice(3).trim()
      continue
    }
    if (token.startsWith('Curve ')) {
      toneCurveName = token.slice(6).trim()
      continue
    }
    const match = token.match(/^([a-z]+)\s+([+-]?\d+(?:\.\d+)?)$/i)
    if (!match) {
      continue
    }
    const key = match[1]?.toLowerCase()
    const value = Number(match[2])
    if (!Number.isFinite(value) || !key) {
      continue
    }
    const keyMap: Record<string, string> = {
      exp: 'exposure',
      ctr: 'contrast',
      hl: 'highlights',
      shd: 'shadows',
      wht: 'whites',
      blk: 'blacks',
      tex: 'texture',
      clr: 'clarity',
      dhz: 'dehaze',
      vib: 'vibrance',
      sat: 'saturation',
      temp: 'temperature',
      tint: 'tint',
    }
    const mapped = keyMap[key]
    if (mapped) {
      basicPayload[mapped] = value
    }
  }

  const basicItems = [
    createRecipeItem({ key: 'exposure', label: 'Exposure', source: basicPayload.exposure, min: -5, max: 5, digits: 2 }),
    createRecipeItem({ key: 'contrast', label: 'Contrast', source: basicPayload.contrast, min: -100, max: 100, digits: 0 }),
    createRecipeItem({ key: 'highlights', label: 'Highlights', source: basicPayload.highlights, min: -100, max: 100, digits: 0 }),
    createRecipeItem({ key: 'shadows', label: 'Shadows', source: basicPayload.shadows, min: -100, max: 100, digits: 0 }),
    createRecipeItem({ key: 'whites', label: 'Whites', source: basicPayload.whites, min: -100, max: 100, digits: 0 }),
    createRecipeItem({ key: 'blacks', label: 'Blacks', source: basicPayload.blacks, min: -100, max: 100, digits: 0 }),
    createRecipeItem({ key: 'texture', label: 'Texture', source: basicPayload.texture, min: -100, max: 100, digits: 0 }),
    createRecipeItem({ key: 'clarity', label: 'Clarity', source: basicPayload.clarity, min: -100, max: 100, digits: 0 }),
    createRecipeItem({ key: 'dehaze', label: 'Dehaze', source: basicPayload.dehaze, min: -100, max: 100, digits: 0 }),
    createRecipeItem({ key: 'vibrance', label: 'Vibrance', source: basicPayload.vibrance, min: -100, max: 100, digits: 0 }),
    createRecipeItem({ key: 'saturation', label: 'Saturation', source: basicPayload.saturation, min: -100, max: 100, digits: 0 }),
    createRecipeItem({
      key: 'temperature',
      label: 'Temperature',
      source: basicPayload.temperature,
      min: 2000,
      max: 50_000,
      digits: 0,
      zeroCentered: false,
      unit: 'K',
    }),
    createRecipeItem({ key: 'tint', label: 'Tint', source: basicPayload.tint, min: -150, max: 150, digits: 0 }),
  ].filter((item): item is RecipeAdjustmentItem => item !== null)

  if (basicItems.length === 0 && !processVersion && !profile && !whiteBalance && !toneCurveName) {
    return null
  }

  return {
    processVersion,
    profile,
    whiteBalance,
    toneCurve: toneCurveName ? { name: toneCurveName } : undefined,
    groups: basicItems.length > 0 ? [{ key: 'basic', label: 'Basic', items: basicItems }] : [],
  }
}

export function parseLightroomRecipeView(value: string | undefined): LightroomRecipeView | null {
  const text = toDisplayText(value)
  if (!text) {
    return null
  }
  let parsed: LightroomRecipePayload
  try {
    parsed = JSON.parse(text) as LightroomRecipePayload
  }
  catch {
    return parseLegacyLightroomRecipeView(text)
  }
  const parsedObject = asObject(parsed)
  if (!parsedObject) {
    return null
  }

  const groups: RecipeAdjustmentGroup[] = []
  const basicPayload = asObject(parsedObject.basic)
  if (basicPayload) {
    const items = [
      createRecipeItem({ key: 'exposure', label: 'Exposure', source: basicPayload.exposure, min: -5, max: 5, digits: 2 }),
      createRecipeItem({ key: 'contrast', label: 'Contrast', source: basicPayload.contrast, min: -100, max: 100, digits: 0 }),
      createRecipeItem({ key: 'highlights', label: 'Highlights', source: basicPayload.highlights, min: -100, max: 100, digits: 0 }),
      createRecipeItem({ key: 'shadows', label: 'Shadows', source: basicPayload.shadows, min: -100, max: 100, digits: 0 }),
      createRecipeItem({ key: 'whites', label: 'Whites', source: basicPayload.whites, min: -100, max: 100, digits: 0 }),
      createRecipeItem({ key: 'blacks', label: 'Blacks', source: basicPayload.blacks, min: -100, max: 100, digits: 0 }),
      createRecipeItem({ key: 'texture', label: 'Texture', source: basicPayload.texture, min: -100, max: 100, digits: 0 }),
      createRecipeItem({ key: 'clarity', label: 'Clarity', source: basicPayload.clarity, min: -100, max: 100, digits: 0 }),
      createRecipeItem({ key: 'dehaze', label: 'Dehaze', source: basicPayload.dehaze, min: -100, max: 100, digits: 0 }),
      createRecipeItem({ key: 'vibrance', label: 'Vibrance', source: basicPayload.vibrance, min: -100, max: 100, digits: 0 }),
      createRecipeItem({ key: 'saturation', label: 'Saturation', source: basicPayload.saturation, min: -100, max: 100, digits: 0 }),
      createRecipeItem({
        key: 'temperature',
        label: 'Temperature',
        source: basicPayload.temperature,
        min: 2000,
        max: 50_000,
        digits: 0,
        zeroCentered: false,
        unit: 'K',
      }),
      createRecipeItem({ key: 'tint', label: 'Tint', source: basicPayload.tint, min: -150, max: 150, digits: 0 }),
    ].filter((item): item is RecipeAdjustmentItem => item !== null)
    if (items.length > 0) {
      groups.push({ key: 'basic', label: 'Basic', items })
    }
  }

  const hslPayload = asObject(parsedObject.hsl)
  if (hslPayload) {
    const items = buildHslItems(hslPayload)
    if (items.length > 0) {
      groups.push({ key: 'hsl', label: 'HSL / Color Mixer', items })
    }
  }

  const colorGradingPayload = asObject(parsedObject.colorGrading)
  if (colorGradingPayload) {
    const items = buildColorGradingItems(colorGradingPayload)
    if (items.length > 0) {
      groups.push({ key: 'color-grading', label: 'Color Grading', items })
    }
  }

  const calibrationPayload = asObject(parsedObject.calibration)
  if (calibrationPayload) {
    const items = buildCalibrationItems(calibrationPayload)
    if (items.length > 0) {
      groups.push({ key: 'calibration', label: 'Calibration', items })
    }
  }

  const toneCurve = parseToneCurvePayload(parsedObject.toneCurve)

  if (groups.length === 0 && !toneCurve) {
    const processVersion = parseRecipeText(parsedObject.processVersion)
    const profile = parseRecipeText(parsedObject.profile)
    const cameraLook = parseRecipeText(parsedObject.cameraLook)
    const whiteBalance = parseRecipeText(parsedObject.whiteBalance)
    if (!processVersion && !profile && !cameraLook && !whiteBalance) {
      return null
    }
    return {
      processVersion,
      profile,
      cameraLook,
      whiteBalance,
      toneCurve,
      groups,
    }
  }

  return {
    processVersion: parseRecipeText(parsedObject.processVersion),
    profile: parseRecipeText(parsedObject.profile),
    cameraLook: parseRecipeText(parsedObject.cameraLook),
    whiteBalance: parseRecipeText(parsedObject.whiteBalance),
    toneCurve,
    groups,
  }
}
