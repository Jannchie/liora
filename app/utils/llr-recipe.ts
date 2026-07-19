import type {
  LlrRecipeView,
  RecipeAdjustmentGroup,
  RecipeAdjustmentItem,
  RecipeCurvePoint,
} from '~/types/gallery'
import {
  asObject,
  createRecipeItem,
  isNearlyEqual,
  parseCurvePoints,
  parseRecipeNumber,
  parseRecipeText,
  toDisplayText,
} from './recipe-fields'

// Pure parsing of the `llrRecipe` metadata field — the `llr:Settings` JSON blob
// LLR (~/llr) embeds on export — into a view model. Grouping, slider ranges and
// neutral defaults mirror LLR's own editor UI rather than Lightroom's, so the
// panel shows the recipe the way it was authored.

const HSL_COLORS = ['Red', 'Orange', 'Yellow', 'Green', 'Aqua', 'Blue', 'Purple', 'Magenta'] as const

// `defaultValue` is the neutral setting LLR itself ships (apps/web/src/App.vue
// `defaultRecipe`); a slider sitting there is not an edit and is not shown.
interface LlrSliderSpec {
  key: string
  label: string
  min: number
  max: number
  digits?: number
  defaultValue?: number
  zeroCentered?: boolean
  unit?: string
}

const SLIDER_GROUPS: { key: string, label: string, items: LlrSliderSpec[] }[] = [
  {
    key: 'tone',
    label: 'Tone',
    items: [
      { key: 'exposure', label: 'Exposure', min: -5, max: 5, digits: 2 },
      { key: 'contrast', label: 'Contrast', min: -100, max: 100, digits: 0 },
      { key: 'highlights', label: 'Highlights', min: -100, max: 100, digits: 0 },
      { key: 'shadows', label: 'Shadows', min: -100, max: 100, digits: 0 },
      { key: 'whites', label: 'Whites', min: -100, max: 100, digits: 0 },
      { key: 'blacks', label: 'Blacks', min: -100, max: 100, digits: 0 },
    ],
  },
  {
    key: 'presence',
    label: 'Presence',
    items: [
      { key: 'clarity', label: 'Clarity', min: -100, max: 100, digits: 0 },
      { key: 'dehaze', label: 'Dehaze', min: -100, max: 100, digits: 0 },
    ],
  },
  {
    key: 'color',
    label: 'Color',
    items: [
      { key: 'temperature', label: 'Temp', min: 2000, max: 12_000, digits: 0, defaultValue: 6500, zeroCentered: false, unit: 'K' },
      { key: 'tint', label: 'Tint', min: -100, max: 100, digits: 0 },
      { key: 'vibrance', label: 'Vibrance', min: -100, max: 100, digits: 0 },
      { key: 'saturation', label: 'Saturation', min: -100, max: 100, digits: 0 },
    ],
  },
  {
    key: 'lens',
    label: 'Lens Corrections',
    items: [
      { key: 'lensDistortion', label: 'Distortion', min: 0, max: 100, digits: 0, defaultValue: 100, zeroCentered: false, unit: '%' },
      { key: 'lensVignetting', label: 'Vignetting', min: 0, max: 100, digits: 0, zeroCentered: false, unit: '%' },
    ],
  },
]

const PARAMETRIC_SPECS: LlrSliderSpec[] = [
  { key: 'highlights', label: 'Highlights', min: -100, max: 100, digits: 0 },
  { key: 'lights', label: 'Lights', min: -100, max: 100, digits: 0 },
  { key: 'darks', label: 'Darks', min: -100, max: 100, digits: 0 },
  { key: 'shadows', label: 'Shadows', min: -100, max: 100, digits: 0 },
  { key: 'shadowSplit', label: 'Shadow Split', min: 0, max: 100, digits: 0, zeroCentered: false, defaultValue: 25 },
  { key: 'midtoneSplit', label: 'Midtone Split', min: 0, max: 100, digits: 0, zeroCentered: false, defaultValue: 50 },
  { key: 'highlightSplit', label: 'Highlight Split', min: 0, max: 100, digits: 0, zeroCentered: false, defaultValue: 75 },
]

const GRADING_TONES = [
  { prefix: 'sh', label: 'Shadows' },
  { prefix: 'md', label: 'Midtones' },
  { prefix: 'hl', label: 'Highlights' },
] as const

// LLR stores grading hue signed around the primary; its own XMP writer folds
// the same value to 0–360 for display, so the panel matches that.
function toHue360(value: number): number {
  return ((Math.round(value) % 360) + 360) % 360
}

function buildSliderGroups(recipe: Record<string, unknown>): RecipeAdjustmentGroup[] {
  const groups: RecipeAdjustmentGroup[] = []
  for (const group of SLIDER_GROUPS) {
    const items = group.items
      .map(spec => createRecipeItem({ ...spec, source: recipe[spec.key] }))
      .filter((item): item is RecipeAdjustmentItem => item !== null)
    if (items.length > 0) {
      groups.push({ key: group.key, label: group.label, items })
    }
  }
  return groups
}

function buildHslItems(payload: Record<string, unknown>): RecipeAdjustmentItem[] {
  const channels = [
    { source: payload.hslHue, suffix: 'hue', label: 'Hue' },
    { source: payload.hslSat, suffix: 'saturation', label: 'Sat' },
    { source: payload.hslLum, suffix: 'luminance', label: 'Lum' },
  ] as const
  const items: RecipeAdjustmentItem[] = []
  // Grouped by colour rather than by channel so the eight bands read together,
  // the way they sit in LLR's colour mixer.
  for (const [index, color] of HSL_COLORS.entries()) {
    for (const channel of channels) {
      if (!Array.isArray(channel.source)) {
        continue
      }
      const item = createRecipeItem({
        key: `${color.toLowerCase()}-${channel.suffix}`,
        label: `${color} ${channel.label}`,
        source: channel.source[index],
        min: -100,
        max: 100,
        digits: 0,
      })
      if (item) {
        items.push(item)
      }
    }
  }
  return items
}

function buildGradingItems(grading: Record<string, unknown>): RecipeAdjustmentItem[] {
  const items: RecipeAdjustmentItem[] = []
  for (const tone of GRADING_TONES) {
    // A hue with no saturation tints nothing, so it is not an edit worth showing.
    const saturation = createRecipeItem({
      key: `${tone.prefix}-saturation`,
      label: `${tone.label} Sat`,
      source: grading[`${tone.prefix}S`],
      min: 0,
      max: 100,
      digits: 0,
      zeroCentered: false,
    })
    if (!saturation) {
      continue
    }
    const hue = parseRecipeNumber(grading[`${tone.prefix}H`])
    if (hue !== null) {
      items.push({
        key: `${tone.prefix}-hue`,
        label: `${tone.label} Hue`,
        value: toHue360(hue),
        min: 0,
        max: 360,
        digits: 0,
        zeroCentered: false,
      })
    }
    items.push(saturation)
  }
  const blend = createRecipeItem({
    key: 'grading-blend',
    label: 'Blend',
    source: grading.blend,
    min: 0,
    max: 100,
    digits: 0,
    defaultValue: 50,
    zeroCentered: false,
  })
  const balance = createRecipeItem({
    key: 'grading-balance',
    label: 'Balance',
    source: grading.balance,
    min: -100,
    max: 100,
    digits: 0,
  })
  items.push(...[blend, balance].filter((item): item is RecipeAdjustmentItem => item !== null))
  return items
}

function isIdentityCurve(points: RecipeCurvePoint[]): boolean {
  return points.length === 2
    && isNearlyEqual(points[0]!.x, 0)
    && isNearlyEqual(points[0]!.y, 0)
    && isNearlyEqual(points[1]!.x, 1)
    && isNearlyEqual(points[1]!.y, 1)
}

function parseCurveChannel(source: unknown): RecipeCurvePoint[] | undefined {
  const points = parseCurvePoints(source)
  if (points.length === 0 || isIdentityCurve(points)) {
    return undefined
  }
  // LLR stores curve points normalized to [0,1]; the panel plots in Lightroom's
  // 0–255 curve space.
  return points.map(point => ({ x: point.x * 255, y: point.y * 255 }))
}

// LLR names the composite channel `rgb`; the rest match the view model.
const CURVE_CHANNELS = [
  { channel: 'composite', key: 'rgb' },
  { channel: 'red', key: 'red' },
  { channel: 'green', key: 'green' },
  { channel: 'blue', key: 'blue' },
] as const

function buildToneCurve(curve: Record<string, unknown>): LlrRecipeView['toneCurve'] {
  const toneCurve: NonNullable<LlrRecipeView['toneCurve']> = {}
  let hasCurve = false
  for (const { channel, key } of CURVE_CHANNELS) {
    const points = parseCurveChannel(curve[key])
    if (points) {
      toneCurve[channel] = points
      hasCurve = true
    }
  }
  return hasCurve ? toneCurve : undefined
}

function buildParametricItems(parametric: Record<string, unknown>): RecipeAdjustmentItem[] {
  return PARAMETRIC_SPECS
    .map(spec => createRecipeItem({ ...spec, source: parametric[spec.key] }))
    .filter((item): item is RecipeAdjustmentItem => item !== null)
}

function describeDenoise(denoise: Record<string, unknown>): string | undefined {
  if (denoise.enabled !== true) {
    return undefined
  }
  const model = parseRecipeText(denoise.model)
  const amount = parseRecipeNumber(denoise.amount)
  const parts = [model, amount === null ? undefined : `${Math.round(amount)}%`].filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : 'on'
}

export function parseLlrRecipeView(value: string | undefined): LlrRecipeView | null {
  const text = toDisplayText(value)
  if (!text) {
    return null
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  }
  catch {
    return null
  }
  const payload = asObject(parsed)
  if (!payload) {
    return null
  }

  const groups: RecipeAdjustmentGroup[] = []
  const recipe = asObject(payload.recipe)
  if (recipe) {
    groups.push(...buildSliderGroups(recipe))
  }

  const hslItems = buildHslItems(payload)
  if (hslItems.length > 0) {
    groups.push({ key: 'hsl', label: 'Color Mixer', items: hslItems })
  }

  const grading = asObject(payload.grading)
  if (grading) {
    const items = buildGradingItems(grading)
    if (items.length > 0) {
      groups.push({ key: 'grading', label: 'Color Grading', items })
    }
  }

  const curve = asObject(payload.curve)
  const toneCurve = curve ? buildToneCurve(curve) : undefined
  const parametric = curve ? asObject(curve.parametric) : null
  if (parametric) {
    const items = buildParametricItems(parametric)
    if (items.length > 0) {
      groups.push({ key: 'parametric-curve', label: 'Parametric Curve', items })
    }
  }

  const version = parseRecipeText(payload.version)
  const profile = parseRecipeText(payload.dcp)
  const denoiseObject = asObject(payload.denoise)
  const denoise = denoiseObject ? describeDenoise(denoiseObject) : undefined
  const aspect = parseRecipeText(payload.aspect)
  const namedAspect = aspect && aspect !== 'orig' ? aspect : undefined

  if (groups.length === 0 && !toneCurve && !profile && !denoise && !namedAspect) {
    return null
  }

  return {
    version,
    profile,
    denoise,
    aspect: namedAspect,
    toneCurve,
    groups,
  }
}
