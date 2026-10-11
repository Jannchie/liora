// Reading the metadata LLR (~/llr) embeds in its JPEG exports.
//
// LLR writes one XMP packet in its own namespace (`http://ns.llr.app/xmp/1.0/`,
// prefix `llr:`) and declares the `llr:Settings` JSON blob — the editor's whole
// snapshot — the authoritative record. Next to it sit flat `llr:*` attributes
// (Exposure, HslHue, Grading…, Crop…) and the point curves as `rdf:Seq`s, a
// subset of the blob for tools that cannot read JSON. When the packet outgrows
// one APP1 segment the blob moves to Extended XMP, which exiftool reassembles.
//
// Everything here works on group-qualified tags (`XMP-llr:Settings`), read in a
// second exiftool pass: the default read flattens every namespace into one, so
// the camera's own EXIF `Contrast` ("Normal") or any other schema's `Version`
// would shadow LLR's values.

import { asObject, parseRecipeNumber, parseRecipeText } from '../../app/utils/recipe-fields'

export const LLR_TAG_GROUP = 'XMP-llr'

/** exiftool arguments that read exactly LLR's namespace, group-qualified. */
export const LLR_READ_ARGS = ['-G1', '-n', `-${LLR_TAG_GROUP}:all`]

// exiftool hands numeric tags back as numbers (`-n`), so text accepts both.
function text(value: unknown): string | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : parseRecipeText(value)
}

function number(value: unknown): number | undefined {
  return parseRecipeNumber(value) ?? undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return asObject(value) !== null
}

/**
 * Whether LLR wrote the file. LLR stamps `Software=LLR` over the camera's and
 * names itself as the XMP toolkit; either is enough, and a future `LLR 1.2`
 * style software string still counts.
 */
export function isLlrExport(tags: Record<string, unknown>): boolean {
  const software = text(tags.Software)?.toUpperCase()
  if (software && (software === 'LLR' || software.startsWith('LLR '))) {
    return true
  }
  return text(tags.XMPToolkit)?.toUpperCase() === 'LLR'
}

/**
 * Drops what the gallery can never use from a snapshot before it is stored:
 * brush and erase strokes are kept as counts (their point lists run to
 * thousands of coordinates and only matter to a re-render), and guided-upright
 * guide lines go entirely. Everything else is kept as LLR wrote it.
 */
export function compactLlrSettings(payload: Record<string, unknown>): Record<string, unknown> {
  const compact: Record<string, unknown> = { ...payload }

  if (Array.isArray(compact.masks)) {
    compact.masks = compact.masks.map((mask) => {
      if (!isRecord(mask) || !Array.isArray(mask.components)) {
        return mask
      }
      return {
        ...mask,
        components: mask.components.map((component) => {
          if (!isRecord(component) || !Array.isArray(component.strokes)) {
            return component
          }
          return { ...component, strokes: component.strokes.length }
        }),
      }
    })
  }

  if (Array.isArray(compact.erase)) {
    const strokes = compact.erase.filter(isRecord)
    compact.erase = {
      fill: strokes.filter(stroke => stroke.mode !== 'heal').length,
      heal: strokes.filter(stroke => stroke.mode === 'heal').length,
    }
  }

  if (isRecord(compact.crop) && isRecord(compact.crop.xf) && 'guides' in compact.crop.xf) {
    const { guides: _guides, ...xf } = compact.crop.xf
    compact.crop = { ...compact.crop, xf }
  }

  if (isRecord(compact.relight) && Array.isArray(compact.relight.lights)) {
    // Light positions are source-image coordinates; only what a light is
    // (kind, strength, colour) says anything to a viewer.
    compact.relight = {
      ...compact.relight,
      lights: compact.relight.lights
        .filter(isRecord)
        .map(({ u: _u, v: _v, id: _id, ...light }) => light),
    }
  }

  return compact
}

function parseSettingsBlob(raw: unknown): Record<string, unknown> | undefined {
  const source = text(raw)
  if (!source) {
    return undefined
  }
  try {
    const parsed: unknown = JSON.parse(source)
    return isRecord(parsed) ? parsed : undefined
  }
  catch {
    return undefined
  }
}

function tag(tags: Record<string, unknown>, name: string): unknown {
  return tags[`${LLR_TAG_GROUP}:${name}`]
}

function numberList(value: unknown): number[] | undefined {
  const source = text(value)
  if (!source) {
    return undefined
  }
  const values = source.split(',').map(entry => Number(entry.trim()))
  return values.length === 8 && values.every(Number.isFinite) ? values : undefined
}

function curvePoints(value: unknown): { x: number, y: number }[] | undefined {
  const entries = Array.isArray(value) ? value : [value]
  const points: { x: number, y: number }[] = []
  for (const entry of entries) {
    const pair = text(entry)?.split(',').map(part => Number(part.trim()))
    if (pair?.length === 2 && pair.every(Number.isFinite)) {
      points.push({ x: pair[0]!, y: pair[1]! })
    }
  }
  return points.length >= 2 ? points : undefined
}

function assign(target: Record<string, unknown>, key: string, value: unknown): void {
  if (value !== undefined) {
    target[key] = value
  }
}

/**
 * A snapshot rebuilt from the flat `llr:*` attributes, for a file whose JSON
 * blob is missing or unreadable (stripped by another tool, truncated). It has
 * the same shape as the blob, so the rest of the pipeline cannot tell — it
 * just carries less: no masks, look, effects or perspective.
 */
export function rebuildLlrSettingsFromAttributes(tags: Record<string, unknown>): Record<string, unknown> | undefined {
  const settings: Record<string, unknown> = {}

  const recipe: Record<string, unknown> = {}
  const recipeTags: [string, string][] = [
    ['exposure', 'Exposure'],
    ['contrast', 'Contrast'],
    ['highlights', 'Highlights'],
    ['shadows', 'Shadows'],
    ['whites', 'Whites'],
    ['blacks', 'Blacks'],
    ['clarity', 'Clarity'],
    ['dehaze', 'Dehaze'],
    ['vibrance', 'Vibrance'],
    ['saturation', 'Saturation'],
    ['temperature', 'Temperature'],
    ['tint', 'Tint'],
    ['lensDistortion', 'LensDistortion'],
    ['lensVignetting', 'LensVignetting'],
  ]
  for (const [key, name] of recipeTags) {
    assign(recipe, key, number(tag(tags, name)))
  }
  if (Object.keys(recipe).length > 0) {
    settings.recipe = recipe
  }

  assign(settings, 'hslHue', numberList(tag(tags, 'HslHue')))
  assign(settings, 'hslSat', numberList(tag(tags, 'HslSaturation')))
  assign(settings, 'hslLum', numberList(tag(tags, 'HslLuminance')))

  const grading: Record<string, unknown> = {}
  const gradingTags: [string, string][] = [
    ['shH', 'GradingShadowHue'],
    ['shS', 'GradingShadowSaturation'],
    ['mdH', 'GradingMidtoneHue'],
    ['mdS', 'GradingMidtoneSaturation'],
    ['hlH', 'GradingHighlightHue'],
    ['hlS', 'GradingHighlightSaturation'],
    ['blend', 'GradingBlend'],
    ['balance', 'GradingBalance'],
  ]
  for (const [key, name] of gradingTags) {
    assign(grading, key, number(tag(tags, name)))
  }
  if (Object.keys(grading).length > 0) {
    settings.grading = grading
  }

  const curve: Record<string, unknown> = {}
  const parametric: Record<string, unknown> = {}
  const parametricTags: [string, string][] = [
    ['shadows', 'ParametricShadows'],
    ['darks', 'ParametricDarks'],
    ['lights', 'ParametricLights'],
    ['highlights', 'ParametricHighlights'],
    ['shadowSplit', 'ParametricShadowSplit'],
    ['midtoneSplit', 'ParametricMidtoneSplit'],
    ['highlightSplit', 'ParametricHighlightSplit'],
  ]
  for (const [key, name] of parametricTags) {
    assign(parametric, key, number(tag(tags, name)))
  }
  if (Object.keys(parametric).length > 0) {
    curve.parametric = parametric
  }
  const curveTags: [string, string][] = [
    ['rgb', 'ToneCurveRgb'],
    ['red', 'ToneCurveRed'],
    ['green', 'ToneCurveGreen'],
    ['blue', 'ToneCurveBlue'],
  ]
  for (const [key, name] of curveTags) {
    assign(curve, key, curvePoints(tag(tags, name)))
  }
  if (Object.keys(curve).length > 0) {
    settings.curve = curve
  }

  assign(settings, 'dcp', text(tag(tags, 'Dcp')))

  const denoiseAmount = number(tag(tags, 'DenoiseAmount'))
  if (denoiseAmount !== undefined) {
    settings.denoise = {
      enabled: true,
      auto: text(tag(tags, 'DenoiseAuto')) === '1',
      amount: denoiseAmount,
    }
  }

  if (/^true$/i.test(text(tag(tags, 'HasCrop')) ?? '')) {
    const crop: Record<string, unknown> = {}
    assign(crop, 'cx', number(tag(tags, 'CropCenterX')))
    assign(crop, 'cy', number(tag(tags, 'CropCenterY')))
    assign(crop, 'w', number(tag(tags, 'CropWidth')))
    assign(crop, 'h', number(tag(tags, 'CropHeight')))
    assign(crop, 'angle', number(tag(tags, 'CropAngle')))
    assign(crop, 'orientation', number(tag(tags, 'CropOrientation')))
    crop.flipH = /^true$/i.test(text(tag(tags, 'CropFlipH')) ?? '')
    crop.flipV = /^true$/i.test(text(tag(tags, 'CropFlipV')) ?? '')
    settings.crop = crop
  }

  return Object.keys(settings).length > 0 ? settings : undefined
}

/**
 * The `llrRecipe` metadata field for a file, from its group-qualified
 * `XMP-llr:*` tags: the JSON snapshot when it parses, the flat attributes
 * otherwise, compacted and stamped with the schema version.
 */
export function buildLlrRecipeFromTags(tags: Record<string, unknown>): string | undefined {
  const settings = parseSettingsBlob(tag(tags, 'Settings')) ?? rebuildLlrSettingsFromAttributes(tags)
  if (!settings) {
    return undefined
  }
  const compact = compactLlrSettings(settings)
  const version = text(tag(tags, 'Version'))
  if (version && /^\d+$/.test(version)) {
    compact.version = version
  }
  return JSON.stringify(compact)
}
