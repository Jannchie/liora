import type {
  LlrMaskView,
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
//
// A recipe is more than its global sliders. A frame can sit at every default
// and still carry three named masks, a Creative Look and a DRO level — reading
// only the sliders showed such a recipe as empty. Everything the blob stores is
// surfaced here: masks with their selections, the look and its tweaks, DRO, the
// denoiser's settings, geometry, and any bypassed modules.

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
  {
    // Older recipes carried the wavelet denoiser's two sliders in `recipe`;
    // current ones use the `denoise` block instead, so these are usually absent.
    key: 'detail',
    label: 'Detail',
    items: [
      { key: 'nrLuminance', label: 'Luminance NR', min: 0, max: 100, digits: 0, zeroCentered: false },
      { key: 'nrDetail', label: 'NR Detail', min: 0, max: 100, digits: 0, defaultValue: 50, zeroCentered: false },
    ],
  },
]

// Sony's Creative Look tweaks, in the order and on the scale of Imaging Edge
// Edit's own panel. `fade` and `clarity` have no negative side — the engine
// clamps them at zero.
const LOOK_SPECS: LlrSliderSpec[] = [
  { key: 'contrast', label: 'Contrast', min: -100, max: 100, digits: 0 },
  { key: 'highlights', label: 'Highlights', min: -100, max: 100, digits: 0 },
  { key: 'shadows', label: 'Shadows', min: -100, max: 100, digits: 0 },
  { key: 'white', label: 'White', min: -100, max: 100, digits: 0 },
  { key: 'black', label: 'Black', min: -100, max: 100, digits: 0 },
  { key: 'fade', label: 'Fade', min: 0, max: 100, digits: 0, zeroCentered: false },
  { key: 'hue', label: 'Hue', min: -100, max: 100, digits: 0 },
  { key: 'saturation', label: 'Saturation', min: -100, max: 100, digits: 0 },
  { key: 'clarity', label: 'Clarity', min: 0, max: 100, digits: 0, zeroCentered: false },
]

// A mask's local sliders. Exposure is in EV; temperature is ±100 ↦ ±4000K and
// hue ±100 ↦ ±0.5rad on the engine side, but the panel shows the stored units
// the way LLR's own mask panel does. `contrast` and `blacks` are stored but not
// applied by the renderer, so they are left out.
const MASK_ADJUST_SPECS: LlrSliderSpec[] = [
  { key: 'exposure', label: 'Exposure', min: -5, max: 5, digits: 2 },
  { key: 'temperature', label: 'Temp', min: -100, max: 100, digits: 0 },
  { key: 'tint', label: 'Tint', min: -100, max: 100, digits: 0 },
  { key: 'saturation', label: 'Saturation', min: -100, max: 100, digits: 0 },
  { key: 'vibrance', label: 'Vibrance', min: -100, max: 100, digits: 0 },
  { key: 'highlights', label: 'Highlights', min: -100, max: 100, digits: 0 },
  { key: 'shadows', label: 'Shadows', min: -100, max: 100, digits: 0 },
  { key: 'clarity', label: 'Clarity', min: -100, max: 100, digits: 0 },
  { key: 'dehaze', label: 'Dehaze', min: -100, max: 100, digits: 0 },
  { key: 'hue', label: 'Hue', min: -100, max: 100, digits: 0 },
  { key: 'tintSat', label: 'Color Sat', min: 0, max: 100, digits: 0, zeroCentered: false },
]

const MASK_OP_SYMBOLS: Record<string, string> = {
  add: '+',
  subtract: '−',
  intersect: '∩',
}

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
  // Two generations of the block: the current AI denoiser reports
  // auto/amount/edge/chroma, the older wavelet one a model name and amount.
  const parts: string[] = []
  const model = parseRecipeText(denoise.model)
  if (model) {
    parts.push(model)
  }
  else if (denoise.auto === true) {
    parts.push('auto')
  }
  const amount = parseRecipeNumber(denoise.amount)
  if (amount !== null) {
    parts.push(`${Math.round(amount)}%`)
  }
  const edge = parseRecipeNumber(denoise.edge)
  if (edge !== null && !isNearlyEqual(edge, 50)) {
    parts.push(`edge ${Math.round(edge)}`)
  }
  const chroma = parseRecipeNumber(denoise.chroma)
  if (chroma !== null && !isNearlyEqual(chroma, 50)) {
    parts.push(`chroma ${Math.round(chroma)}`)
  }
  return parts.length > 0 ? parts.join(' · ') : 'on'
}

/**
 * DRO resolves from two fields: `dro` is the strength and `droLevel` the
 * preset. A strength of zero is off whatever the level says; -1 is the
 * camera's own auto curve.
 */
function describeDro(payload: Record<string, unknown>): string | undefined {
  const strength = parseRecipeNumber(payload.dro)
  const level = parseRecipeNumber(payload.droLevel)
  if (strength === null && level === null) {
    return undefined
  }
  if (strength !== null && strength <= 0) {
    return 'off'
  }
  if (level === null || level < 0) {
    return strength === null ? 'auto' : `auto ${Math.round(strength)}`
  }
  return `Lv${Math.round(level)}`
}

function buildLookItems(look: Record<string, unknown>): RecipeAdjustmentItem[] {
  return LOOK_SPECS
    .map(spec => createRecipeItem({ ...spec, source: look[spec.key] }))
    .filter((item): item is RecipeAdjustmentItem => item !== null)
}

function describeRange(from: unknown, to: unknown): string {
  const lo = parseRecipeNumber(from)
  const hi = parseRecipeNumber(to)
  return lo === null || hi === null ? '' : ` ${Math.round(lo)}–${Math.round(hi)}`
}

function describeMaskComponent(source: unknown, index: number): string | null {
  const component = asObject(source)
  if (!component) {
    return null
  }
  const type = parseRecipeText(component.type)
  if (!type) {
    return null
  }
  // The first component has nothing to combine with, so its operator is noise.
  const op = index === 0 ? '' : `${MASK_OP_SYMBOLS[parseRecipeText(component.op) ?? 'add'] ?? '+'} `
  const inverted = component.invert === true ? ' (inverted)' : ''

  switch (type) {
    case 'luminance': {
      return `${op}Luminance${describeRange(component.lo, component.hi)}${inverted}`
    }
    case 'color': {
      // Stored as an Oklab hue centre in radians.
      const hue = parseRecipeNumber(component.hue)
      const degrees = hue === null ? '' : ` ${Math.round(((hue * 180) / Math.PI + 360) % 360)}°`
      return `${op}Color${degrees}${inverted}`
    }
    case 'linear': {
      return `${op}Linear${inverted}`
    }
    case 'radial': {
      return `${op}Radial${inverted}`
    }
    default: {
      return `${op}${type}${inverted}`
    }
  }
}

function buildMask(source: unknown, index: number): LlrMaskView | null {
  const mask = asObject(source)
  if (!mask) {
    return null
  }
  const adjust = asObject(mask.adjust)
  const items = adjust
    ? MASK_ADJUST_SPECS
        .map(spec => createRecipeItem({ ...spec, source: adjust[spec.key] }))
        .filter((item): item is RecipeAdjustmentItem => item !== null)
    : []

  const components = Array.isArray(mask.components)
    ? mask.components
        .map((component, componentIndex) => describeMaskComponent(component, componentIndex))
        .filter((entry): entry is string => entry !== null)
    : []

  // A mask with no selection and no deltas describes nothing.
  if (components.length === 0 && items.length === 0) {
    return null
  }

  return {
    key: parseRecipeText(mask.id) ?? `mask-${index}`,
    name: parseRecipeText(mask.name),
    disabled: mask.enabled === false,
    inverted: mask.invert === true,
    components,
    items,
  }
}

function buildMasks(source: unknown): LlrMaskView[] {
  if (!Array.isArray(source)) {
    return []
  }
  return source
    .map((mask, index) => buildMask(mask, index))
    .filter((mask): mask is LlrMaskView => mask !== null)
}

/**
 * Crop, rotation, flips and perspective as one line — only the parts that
 * moved. The crop box is stored normalized, so a full-frame box is `w`/`h` of
 * 1 and no offset.
 */
function describeGeometry(crop: Record<string, unknown>): string | undefined {
  const parts: string[] = []

  const width = parseRecipeNumber(crop.w)
  const height = parseRecipeNumber(crop.h)
  if (width !== null && height !== null && (!isNearlyEqual(width, 1) || !isNearlyEqual(height, 1))) {
    parts.push(`crop ${Math.round(width * 100)}% × ${Math.round(height * 100)}%`)
  }

  const angle = parseRecipeNumber(crop.angle)
  if (angle !== null && !isNearlyEqual(angle, 0)) {
    parts.push(`rotate ${angle.toFixed(1)}°`)
  }

  const orientation = parseRecipeNumber(crop.orientation)
  if (orientation !== null && orientation !== 0) {
    parts.push(`orientation ${Math.round(orientation) * 90}°`)
  }

  const flips = [crop.flipH === true ? 'H' : null, crop.flipV === true ? 'V' : null].filter(Boolean)
  if (flips.length > 0) {
    parts.push(`flip ${flips.join('+')}`)
  }

  const transform = asObject(crop.xf)
  if (transform) {
    const perspective: { key: string, label: string, neutral: number }[] = [
      { key: 'vertical', label: 'vertical', neutral: 0 },
      { key: 'horizontal', label: 'horizontal', neutral: 0 },
      { key: 'aspect', label: 'aspect', neutral: 0 },
      { key: 'scale', label: 'scale', neutral: 100 },
      { key: 'offsetX', label: 'offset X', neutral: 0 },
      { key: 'offsetY', label: 'offset Y', neutral: 0 },
    ]
    for (const entry of perspective) {
      const value = parseRecipeNumber(transform[entry.key])
      if (value !== null && !isNearlyEqual(value, entry.neutral)) {
        parts.push(`${entry.label} ${Math.round(value)}`)
      }
    }
  }

  return parts.length > 0 ? parts.join(' · ') : undefined
}

function buildBypass(source: unknown): string[] {
  if (!Array.isArray(source)) {
    return []
  }
  return source
    .map(entry => parseRecipeText(entry))
    .filter((entry): entry is string => entry !== undefined)
}

/** Camera-matching switches, reported only when moved off their default. */
function buildToggles(payload: Record<string, unknown>): string[] {
  const toggles: string[] = []
  if (payload.sonyAdvancedColour === true) {
    toggles.push('Advanced colour')
  }
  if (payload.sonyCameraMatch === false) {
    toggles.push('Camera match off')
  }
  return toggles
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
  // `profile` is the rendering pipeline (sony / standard); `dcp` is the camera
  // style baked into it. They are different things and were previously
  // conflated, which hid the profile whenever a style was absent.
  const profile = parseRecipeText(payload.profile)
  const dcp = parseRecipeText(payload.dcp)
  const denoiseObject = asObject(payload.denoise)
  const denoise = denoiseObject ? describeDenoise(denoiseObject) : undefined
  const aspect = parseRecipeText(payload.aspect)
  const namedAspect = aspect && aspect !== 'orig' ? aspect : undefined

  const lookObject = asObject(payload.look)
  const lookItems = lookObject ? buildLookItems(lookObject) : []
  const lookStyle = parseRecipeText(payload.lookStyle)
  const dro = describeDro(payload)

  const cropObject = asObject(payload.crop)
  const geometry = cropObject ? describeGeometry(cropObject) : undefined

  const masks = buildMasks(payload.masks)
  const bypass = buildBypass(payload.bypass)
  const toggles = buildToggles(payload)

  const hasContent = groups.length > 0
    || masks.length > 0
    || lookItems.length > 0
    || bypass.length > 0
    || toggles.length > 0
    || Boolean(toneCurve || profile || dcp || lookStyle || dro || denoise || namedAspect || geometry)

  if (!hasContent) {
    return null
  }

  return {
    version,
    profile,
    dcp,
    lookStyle,
    lookItems,
    dro,
    denoise,
    aspect: namedAspect,
    geometry,
    bypass,
    toggles,
    toneCurve,
    groups,
    masks,
  }
}
