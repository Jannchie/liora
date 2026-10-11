import type {
  LlrMaskView,
  LlrRecipeView,
  RecipeAdjustmentGroup,
  RecipeAdjustmentItem,
  RecipeCurvePoint,
  RecipeFact,
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
// LLR (~/llr) embeds on export, compacted on upload (server/utils/llr-metadata)
// — into a view model. Grouping, slider ranges, neutral defaults and wording
// mirror LLR's own editor (apps/web/src/App.vue, i18n.ts) rather than
// Lightroom's, so the panel shows the recipe the way it was authored.
//
// A recipe is more than its global sliders. A frame can sit at every default
// and still carry three named masks, a Creative Look, a relight rig and a DRO
// level — everything the blob stores is surfaced: the slider panels (effects
// included), masks with their selections, the look, relight, erase, denoise,
// geometry, and which panels were switched off in the editor.
//
// Labels come from `translate`, called with keys under `gallery.llr` (and a few
// under `gallery.metadata`), so the parser stays free of the i18n runtime.

export type LlrTranslate = (key: string, params?: Record<string, unknown>) => string

const HSL_COLORS = ['red', 'orange', 'yellow', 'green', 'aqua', 'blue', 'purple', 'magenta'] as const

// `defaultValue` is the neutral setting LLR itself ships (App.vue
// `defaultRecipe`); a slider sitting there is not an edit and is not shown.
interface LlrSliderSpec {
  key: string
  min: number
  max: number
  digits?: number
  defaultValue?: number
  zeroCentered?: boolean
  unit?: string
  track?: RecipeAdjustmentItem['track']
}

// LLR's slider groups, in the editor's order. The group key is LLR's own panel
// key, which is also what its `bypass` list names.
const SLIDER_GROUPS: { key: string, items: LlrSliderSpec[] }[] = [
  {
    key: 'tone',
    items: [
      { key: 'exposure', min: -5, max: 5, digits: 2 },
      { key: 'contrast', min: -100, max: 100 },
      { key: 'highlights', min: -100, max: 100 },
      { key: 'shadows', min: -100, max: 100 },
      { key: 'whites', min: -100, max: 100 },
      { key: 'blacks', min: -100, max: 100 },
    ],
  },
  {
    key: 'presence',
    items: [
      { key: 'clarity', min: -100, max: 100 },
      { key: 'dehaze', min: -100, max: 100 },
    ],
  },
  {
    key: 'color',
    items: [
      { key: 'temperature', min: 2000, max: 12_000, defaultValue: 6500, zeroCentered: false, unit: 'K', track: 'temperature' },
      { key: 'tint', min: -100, max: 100 },
      { key: 'vibrance', min: -100, max: 100 },
      { key: 'saturation', min: -100, max: 100 },
    ],
  },
  {
    key: 'lens',
    items: [
      { key: 'lensDistortion', min: 0, max: 100, defaultValue: 100, zeroCentered: false, unit: '%' },
      { key: 'lensVignetting', min: 0, max: 100, zeroCentered: false, unit: '%' },
    ],
  },
  {
    // Older recipes carried the wavelet denoiser's two sliders here; current
    // ones use the `denoise` block instead, so these are usually absent.
    key: 'noise',
    items: [
      { key: 'nrLuminance', min: 0, max: 100, zeroCentered: false },
      { key: 'nrDetail', min: 0, max: 100, defaultValue: 50, zeroCentered: false },
    ],
  },
  {
    key: 'sharpen',
    items: [
      { key: 'sharpAmount', min: 0, max: 150, zeroCentered: false },
      { key: 'sharpRadius', min: 0.5, max: 3, digits: 1, defaultValue: 1, zeroCentered: false },
      { key: 'sharpDetail', min: 0, max: 100, defaultValue: 25, zeroCentered: false },
      { key: 'sharpMasking', min: 0, max: 100, zeroCentered: false },
    ],
  },
  {
    key: 'defringe',
    items: [
      { key: 'defringePurple', min: 0, max: 100, zeroCentered: false },
      { key: 'defringeGreen', min: 0, max: 100, zeroCentered: false },
    ],
  },
  {
    // The focus point (`blurFocusX/Y`) is a position on the source frame,
    // not a setting a viewer can read anything from.
    key: 'lensBlur',
    items: [
      { key: 'blurAmount', min: 0, max: 100, zeroCentered: false },
      { key: 'blurRange', min: 0, max: 100, defaultValue: 20, zeroCentered: false },
    ],
  },
  {
    key: 'fog',
    items: [
      { key: 'fogAmount', min: -100, max: 100 },
      { key: 'fogStart', min: 0, max: 100, defaultValue: 30, zeroCentered: false },
    ],
  },
  {
    key: 'vignette',
    items: [
      { key: 'vigAmount', min: -100, max: 100 },
      { key: 'vigMidpoint', min: 0, max: 100, defaultValue: 50, zeroCentered: false },
      { key: 'vigFeather', min: 0, max: 100, defaultValue: 50, zeroCentered: false },
      { key: 'vigRoundness', min: -100, max: 100 },
    ],
  },
  {
    key: 'grain',
    items: [
      { key: 'grainAmount', min: 0, max: 100, zeroCentered: false },
      { key: 'grainSize', min: 0, max: 100, defaultValue: 25, zeroCentered: false },
      { key: 'grainRoughness', min: 0, max: 100, defaultValue: 50, zeroCentered: false },
    ],
  },
]

// A group's secondary sliders (radius, midpoint, size…) shape an effect that is
// not there while its amount is zero; LLR's renderer skips the whole pass.
const GROUP_AMOUNT_KEYS: Record<string, string> = {
  sharpen: 'sharpAmount',
  lensBlur: 'blurAmount',
  fog: 'fogAmount',
  vignette: 'vigAmount',
  grain: 'grainAmount',
}

// Sony's Creative Look tweaks, in the order and on the scale of Imaging Edge
// Edit's own panel. `fade` and `clarity` have no negative side — the engine
// clamps them at zero.
const LOOK_SPECS: LlrSliderSpec[] = [
  { key: 'contrast', min: -100, max: 100 },
  { key: 'highlights', min: -100, max: 100 },
  { key: 'shadows', min: -100, max: 100 },
  { key: 'white', min: -100, max: 100 },
  { key: 'black', min: -100, max: 100 },
  { key: 'fade', min: 0, max: 100, zeroCentered: false },
  { key: 'hue', min: -100, max: 100 },
  { key: 'saturation', min: -100, max: 100 },
  { key: 'clarity', min: 0, max: 100, zeroCentered: false },
]

// A mask's local sliders. Exposure is in EV; temperature is ±100 ↦ ±4000K and
// hue ±100 ↦ ±0.5rad on the engine side, but the panel shows the stored units
// the way LLR's own mask panel does. `contrast` and `blacks` are stored but not
// applied by the renderer, so they are left out; the colour cast (`tintHue`,
// `tintSat`) is handled on its own below.
const MASK_ADJUST_SPECS: LlrSliderSpec[] = [
  { key: 'exposure', min: -5, max: 5, digits: 2 },
  { key: 'temperature', min: -100, max: 100 },
  { key: 'tint', min: -100, max: 100 },
  { key: 'saturation', min: -100, max: 100 },
  { key: 'vibrance', min: -100, max: 100 },
  { key: 'highlights', min: -100, max: 100 },
  { key: 'shadows', min: -100, max: 100 },
  { key: 'clarity', min: -100, max: 100 },
  { key: 'dehaze', min: -100, max: 100 },
  { key: 'hue', min: -100, max: 100 },
  { key: 'moire', min: 0, max: 100, zeroCentered: false },
]

const MASK_OP_SYMBOLS: Record<string, string> = {
  add: '+',
  subtract: '−',
  intersect: '∩',
}

const PARAMETRIC_SPECS: LlrSliderSpec[] = [
  { key: 'highlights', min: -100, max: 100 },
  { key: 'lights', min: -100, max: 100 },
  { key: 'darks', min: -100, max: 100 },
  { key: 'shadows', min: -100, max: 100 },
  { key: 'shadowSplit', min: 0, max: 100, zeroCentered: false, defaultValue: 25 },
  { key: 'midtoneSplit', min: 0, max: 100, zeroCentered: false, defaultValue: 50 },
  { key: 'highlightSplit', min: 0, max: 100, zeroCentered: false, defaultValue: 75 },
]

// Relight's rig-wide settings; LLR's defaults (relight.ts `defaultRelight`).
const RELIGHT_SPECS: LlrSliderSpec[] = [
  { key: 'ambient', min: -5, max: 1, digits: 2, unit: ' EV' },
  { key: 'wrap', min: 0, max: 1, digits: 2, defaultValue: 0.3, zeroCentered: false },
  { key: 'falloff', min: 0, max: 1, digits: 2, defaultValue: 1, zeroCentered: false },
  { key: 'shadows', min: 0, max: 1, digits: 2, defaultValue: 0.8, zeroCentered: false },
]

const GRADING_TONES = ['sh', 'md', 'hl'] as const

// LLR stores grading hue signed around the primary; its own XMP writer folds
// the same value to 0–360 for display, so the panel matches that.
function toHue360(value: number): number {
  return ((Math.round(value) % 360) + 360) % 360
}

function present<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined
}

/** The moved sliders of `specs`, each labelled `${labelPrefix}.${key}`. */
function buildItems(
  source: Record<string, unknown>,
  specs: LlrSliderSpec[],
  t: LlrTranslate,
  labelPrefix: string,
): RecipeAdjustmentItem[] {
  return specs
    .map((spec) => {
      const item = createRecipeItem({ ...spec, digits: spec.digits ?? 0, label: t(`${labelPrefix}.${spec.key}`), source: source[spec.key] })
      return item && spec.track ? { ...item, track: spec.track } : item
    })
    .filter(present)
}

/** A hue on LLR's signed scale, shown as a 0–360° position on a hue wheel. */
function hueItem(key: string, label: string, raw: number): RecipeAdjustmentItem {
  return { key, label, value: toHue360(raw), min: 0, max: 360, digits: 0, zeroCentered: false, unit: '°', track: 'hue' }
}

function buildHslItems(payload: Record<string, unknown>, t: LlrTranslate): RecipeAdjustmentItem[] {
  const channels = [
    { source: payload.hslHue, suffix: 'hue' },
    { source: payload.hslSat, suffix: 'saturation' },
    { source: payload.hslLum, suffix: 'luminance' },
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
        key: `${color}-${channel.suffix}`,
        label: t(`gallery.llr.hsl.${channel.suffix}`, { color: t(`gallery.llr.hsl.${color}`) }),
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

function buildGradingItems(grading: Record<string, unknown>, t: LlrTranslate): RecipeAdjustmentItem[] {
  const items: RecipeAdjustmentItem[] = []
  for (const tone of GRADING_TONES) {
    const toneLabel = t(`gallery.llr.grading.${tone}`)
    // A hue with no saturation tints nothing, so it is not an edit worth showing.
    const saturation = createRecipeItem({
      key: `${tone}-saturation`,
      label: t('gallery.llr.grading.saturation', { tone: toneLabel }),
      source: grading[`${tone}S`],
      min: 0,
      max: 100,
      digits: 0,
      zeroCentered: false,
    })
    if (!saturation) {
      continue
    }
    const hue = parseRecipeNumber(grading[`${tone}H`])
    if (hue !== null) {
      items.push(hueItem(`${tone}-hue`, t('gallery.llr.grading.hue', { tone: toneLabel }), hue))
    }
    items.push(saturation)
  }
  const blend = createRecipeItem({
    key: 'grading-blend',
    label: t('gallery.llr.grading.blend'),
    source: grading.blend,
    min: 0,
    max: 100,
    digits: 0,
    defaultValue: 50,
    zeroCentered: false,
  })
  const balance = createRecipeItem({
    key: 'grading-balance',
    label: t('gallery.llr.grading.balance'),
    source: grading.balance,
    min: -100,
    max: 100,
    digits: 0,
  })
  items.push(...[blend, balance].filter(present))
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

function describeDenoise(denoise: Record<string, unknown>, t: LlrTranslate): string | undefined {
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
    parts.push(t('gallery.llr.denoise.auto'))
  }
  const amount = parseRecipeNumber(denoise.amount)
  if (amount !== null) {
    parts.push(`${Math.round(amount)}%`)
  }
  const edge = parseRecipeNumber(denoise.edge)
  if (edge !== null && !isNearlyEqual(edge, 50)) {
    parts.push(t('gallery.llr.denoise.edge', { n: Math.round(edge) }))
  }
  const chroma = parseRecipeNumber(denoise.chroma)
  if (chroma !== null && !isNearlyEqual(chroma, 50)) {
    parts.push(t('gallery.llr.denoise.chroma', { n: Math.round(chroma) }))
  }
  return parts.length > 0 ? parts.join(' · ') : t('gallery.llr.denoise.on')
}

/**
 * DRO resolves from two fields: `dro` is the strength and `droLevel` the
 * preset. A strength of zero is off whatever the level says; -1 is the
 * camera's own auto curve.
 */
function describeDro(payload: Record<string, unknown>, t: LlrTranslate): string | undefined {
  const strength = parseRecipeNumber(payload.dro)
  const level = parseRecipeNumber(payload.droLevel)
  if (strength === null && level === null) {
    return undefined
  }
  if (strength !== null && strength <= 0) {
    return t('gallery.llr.dro.off')
  }
  if (level === null || level < 0) {
    return strength === null
      ? t('gallery.llr.dro.auto')
      : t('gallery.llr.dro.autoStrength', { n: Math.round(strength) })
  }
  return t('gallery.llr.dro.level', { n: Math.round(level) })
}

function describeRange(from: unknown, to: unknown): string {
  const lo = parseRecipeNumber(from)
  const hi = parseRecipeNumber(to)
  return lo === null || hi === null ? '' : ` ${Math.round(lo)}–${Math.round(hi)}`
}

function radiansToDegrees(value: number): number {
  return (value * 180) / Math.PI
}

function describeMaskSelection(component: Record<string, unknown>, type: string, t: LlrTranslate): string {
  switch (type) {
    case 'luminance':
    case 'depth': {
      return `${t(`gallery.llr.mask.type.${type}`)}${describeRange(component.lo, component.hi)}`
    }
    case 'color': {
      // Stored as an Oklab hue centre and half-width, both in radians.
      const hue = parseRecipeNumber(component.hue)
      const width = parseRecipeNumber(component.hueWidth)
      const centre = hue === null ? '' : ` ${toHue360(radiansToDegrees(hue))}°`
      const spread = width === null ? '' : ` ± ${Math.round(radiansToDegrees(width))}°`
      return `${t('gallery.llr.mask.type.color')}${centre}${spread}`
    }
    case 'radial': {
      const feather = parseRecipeNumber(component.feather)
      const label = t('gallery.llr.mask.type.radial')
      return feather === null ? label : `${label} · ${t('gallery.llr.mask.feather', { n: Math.round(feather * 100) })}`
    }
    case 'brush': {
      // Stored strokes are compacted to their count on upload; an uncompacted
      // blob still carries the list.
      const strokes = Array.isArray(component.strokes) ? component.strokes.length : parseRecipeNumber(component.strokes)
      const label = t('gallery.llr.mask.type.brush')
      return strokes ? `${label} · ${t('gallery.llr.mask.strokes', { n: strokes })}` : label
    }
    case 'ai': {
      const kind = parseRecipeText(component.kind)
      return kind && ['subject', 'sky', 'person'].includes(kind)
        ? t(`gallery.llr.mask.ai.${kind}`)
        : t('gallery.llr.mask.type.ai')
    }
    case 'linear': {
      return t('gallery.llr.mask.type.linear')
    }
    default: {
      return type
    }
  }
}

function describeMaskComponent(source: unknown, index: number, t: LlrTranslate): string | null {
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
  const inverted = component.invert === true ? ` · ${t('gallery.llr.mask.inverted')}` : ''
  return `${op}${describeMaskSelection(component, type, t)}${inverted}`
}

function buildMaskItems(adjust: Record<string, unknown>, t: LlrTranslate): RecipeAdjustmentItem[] {
  const items = buildItems(adjust, MASK_ADJUST_SPECS, t, 'gallery.llr.slider')
  // The colour cast is one control in LLR: a hue and how strongly it tints.
  // Without strength the hue does nothing, so it only shows alongside it.
  const strength = createRecipeItem({
    key: 'tintSat',
    label: t('gallery.llr.slider.tintSat'),
    source: adjust.tintSat,
    min: 0,
    max: 100,
    digits: 0,
    zeroCentered: false,
  })
  if (strength) {
    const hue = parseRecipeNumber(adjust.tintHue)
    if (hue !== null) {
      items.push(hueItem('tintHue', t('gallery.llr.slider.tintHue'), hue))
    }
    items.push(strength)
  }
  return items
}

function buildMask(source: unknown, index: number, t: LlrTranslate): LlrMaskView | null {
  const mask = asObject(source)
  if (!mask) {
    return null
  }
  const adjust = asObject(mask.adjust)
  const items = adjust ? buildMaskItems(adjust, t) : []

  const components = Array.isArray(mask.components)
    ? mask.components
        .map((component, componentIndex) => describeMaskComponent(component, componentIndex, t))
        .filter(present)
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

function buildMasks(source: unknown, t: LlrTranslate): LlrMaskView[] {
  if (!Array.isArray(source)) {
    return []
  }
  return source
    .map((mask, index) => buildMask(mask, index, t))
    .filter(present)
}

/**
 * Crop, straighten, rotation, flips and perspective as one line — only the
 * parts that moved. The crop box is stored normalized, so a full-frame box is
 * `w`/`h` of 1; `orientation` is a quarter turn in degrees (0/90/180/270).
 */
function describeGeometry(crop: Record<string, unknown>, t: LlrTranslate): string | undefined {
  const parts: string[] = []

  const width = parseRecipeNumber(crop.w)
  const height = parseRecipeNumber(crop.h)
  if (width !== null && height !== null && (!isNearlyEqual(width, 1) || !isNearlyEqual(height, 1))) {
    parts.push(t('gallery.llr.geometry.crop', { w: Math.round(width * 100), h: Math.round(height * 100) }))
  }

  const angle = parseRecipeNumber(crop.angle)
  if (angle !== null && !isNearlyEqual(angle, 0)) {
    parts.push(t('gallery.llr.geometry.rotate', { n: angle.toFixed(1) }))
  }

  const orientation = parseRecipeNumber(crop.orientation)
  if (orientation !== null && Math.round(orientation) % 360 !== 0) {
    parts.push(t('gallery.llr.geometry.orientation', { n: Math.round(orientation) % 360 }))
  }

  if (crop.flipH === true) {
    parts.push(t('gallery.llr.geometry.flipH'))
  }
  if (crop.flipV === true) {
    parts.push(t('gallery.llr.geometry.flipV'))
  }

  return parts.length > 0 ? parts.join(' · ') : undefined
}

function describeTransform(transform: Record<string, unknown>, t: LlrTranslate): string | undefined {
  const perspective: { key: string, neutral: number }[] = [
    { key: 'vertical', neutral: 0 },
    { key: 'horizontal', neutral: 0 },
    { key: 'aspect', neutral: 0 },
    { key: 'scale', neutral: 100 },
    { key: 'offsetX', neutral: 0 },
    { key: 'offsetY', neutral: 0 },
  ]
  const parts: string[] = []
  for (const entry of perspective) {
    const value = parseRecipeNumber(transform[entry.key])
    if (value !== null && !isNearlyEqual(value, entry.neutral)) {
      parts.push(t(`gallery.llr.geometry.xf.${entry.key}`, { n: Math.round(value) }))
    }
  }
  return parts.length > 0 ? parts.join(' · ') : undefined
}

/** Erase strokes by kind: generative fill and the heal brush. */
function describeErase(source: unknown, t: LlrTranslate): string | undefined {
  let fill = 0
  let heal = 0
  if (Array.isArray(source)) {
    for (const stroke of source) {
      if (asObject(stroke)?.mode === 'heal') {
        heal += 1
      }
      else {
        fill += 1
      }
    }
  }
  else {
    const counts = asObject(source)
    fill = parseRecipeNumber(counts?.fill) ?? 0
    heal = parseRecipeNumber(counts?.heal) ?? 0
  }
  const parts = [
    fill > 0 ? t('gallery.llr.erase.fill', { n: fill }) : null,
    heal > 0 ? t('gallery.llr.erase.heal', { n: heal }) : null,
  ].filter(present)
  return parts.length > 0 ? parts.join(' · ') : undefined
}

/**
 * The relight rig as a slider group: the rig-wide settings that moved, then
 * one row per light at its intensity — a light is an edit whatever its value.
 */
function buildRelightItems(relight: Record<string, unknown>, t: LlrTranslate): RecipeAdjustmentItem[] {
  const lights = Array.isArray(relight.lights) ? relight.lights.map(asObject).filter(present) : []
  if (lights.length === 0) {
    return []
  }
  const items = buildItems(relight, RELIGHT_SPECS, t, 'gallery.llr.relight')
  for (const [index, light] of lights.entries()) {
    const kind = parseRecipeText(light.kind) ?? 'point'
    const ev = parseRecipeNumber(light.ev) ?? 0
    items.push({
      key: `light-${index}`,
      label: `${['point', 'spot', 'sun'].includes(kind) ? t(`gallery.llr.relight.kind.${kind}`) : kind} ${index + 1}`,
      value: ev,
      min: -4,
      max: 6,
      digits: 1,
      unit: ' EV',
    })
  }
  return items
}

/** Camera-matching switches, reported only when moved off their default. */
function buildToggles(payload: Record<string, unknown>, t: LlrTranslate): string[] {
  const toggles: string[] = []
  if (payload.sonyAdvancedColour === true) {
    toggles.push(t('gallery.llr.toggle.advancedColour'))
  }
  if (payload.sonyCameraMatch === false) {
    toggles.push(t('gallery.llr.toggle.cameraMatchOff'))
  }
  return toggles
}

function buildBypass(source: unknown): Set<string> {
  if (!Array.isArray(source)) {
    return new Set()
  }
  return new Set(source.map(entry => parseRecipeText(entry)).filter(present))
}

export function parseLlrRecipeView(value: string | undefined, t: LlrTranslate): LlrRecipeView | null {
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

  // Bypassed panels stay in the recipe (LLR keeps their values for a
  // before/after) but leave the render, so they are shown struck out.
  const bypass = buildBypass(payload.bypass)

  const groups: RecipeAdjustmentGroup[] = []
  const pushGroup = (key: string, items: RecipeAdjustmentItem[], labelKey: string = key): void => {
    if (items.length > 0) {
      groups.push({ key, label: t(`gallery.llr.group.${labelKey}`), items, bypassed: bypass.has(key) || undefined })
    }
  }

  const recipe = asObject(payload.recipe)
  if (recipe) {
    for (const group of SLIDER_GROUPS) {
      const amountKey = GROUP_AMOUNT_KEYS[group.key]
      if (!amountKey || !isNearlyEqual(parseRecipeNumber(recipe[amountKey]) ?? 0, 0)) {
        pushGroup(group.key, buildItems(recipe, group.items, t, 'gallery.llr.slider'))
      }
    }
  }

  pushGroup('hsl', buildHslItems(payload, t))

  const grading = asObject(payload.grading)
  pushGroup('grading', grading ? buildGradingItems(grading, t) : [])

  const curve = asObject(payload.curve)
  const toneCurve = curve ? buildToneCurve(curve) : undefined
  const parametric = curve ? asObject(curve.parametric) : null
  pushGroup('curve', parametric ? buildItems(parametric, PARAMETRIC_SPECS, t, 'gallery.llr.parametric') : [], 'parametric')

  // The Creative Look's tweaks drive Sony's own stages rather than the Tone
  // panel's sliders, so they are a group of their own.
  const lookObject = asObject(payload.look)
  pushGroup('look', lookObject ? buildItems(lookObject, LOOK_SPECS, t, 'gallery.llr.look') : [])

  const relightObject = asObject(payload.relight)
  pushGroup('relight', relightObject ? buildRelightItems(relightObject, t) : [])

  const facts: RecipeFact[] = []
  const pushFact = (key: string, label: string, factValue: string | undefined, bypassKey?: string): void => {
    if (factValue) {
      facts.push({ key, label, value: factValue, bypassed: bypassKey ? bypass.has(bypassKey) : undefined })
    }
  }

  // `profile` is the rendering pipeline (sony / standard); `dcp` is the camera
  // style baked into it. They are different things.
  const profile = parseRecipeText(payload.profile)
  pushFact(
    'profile',
    t('gallery.metadata.llrProfile'),
    profile && ['sony', 'standard'].includes(profile) ? t(`gallery.llr.profile.${profile}`) : profile,
  )
  pushFact('dcp', t('gallery.metadata.llrStyle'), parseRecipeText(payload.dcp))
  pushFact('lookStyle', t('gallery.metadata.llrLook'), parseRecipeText(payload.lookStyle), 'look')
  pushFact('dro', 'DRO', describeDro(payload, t), 'look')
  const denoiseObject = asObject(payload.denoise)
  pushFact('denoise', t('gallery.metadata.llrDenoise'), denoiseObject ? describeDenoise(denoiseObject, t) : undefined)
  const aspect = parseRecipeText(payload.aspect)
  // `orig` and `free` are the two unconstrained modes; only a ratio says
  // something about the framing.
  pushFact('aspect', t('gallery.metadata.llrAspect'), aspect && aspect !== 'orig' && aspect !== 'free' ? aspect.replace(/^custom:/, '') : undefined)
  const cropObject = asObject(payload.crop)
  pushFact('geometry', t('gallery.metadata.llrGeometry'), cropObject ? describeGeometry(cropObject, t) : undefined)
  const transform = cropObject ? asObject(cropObject.xf) : null
  pushFact('transform', t('gallery.llr.group.transform'), transform ? describeTransform(transform, t) : undefined, 'transform')
  pushFact('erase', t('gallery.metadata.llrErase'), describeErase(payload.erase, t))

  const masks = buildMasks(payload.masks, t)
  const toggles = buildToggles(payload, t)

  const hasContent = groups.length > 0
    || masks.length > 0
    || facts.length > 0
    || toggles.length > 0
    || Boolean(toneCurve)

  if (!hasContent) {
    return null
  }

  return {
    version: parseRecipeText(payload.version),
    facts,
    toggles,
    toneCurve,
    toneCurveBypassed: Boolean(toneCurve) && bypass.has('curve'),
    groups,
    masks,
    masksBypassed: masks.length > 0 && bypass.has('masks'),
  }
}
