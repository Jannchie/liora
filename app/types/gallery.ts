import type { ImageSizes } from '@nuxt/image'
import type { FileResponse } from './file'

export type ImageAttrs = ImageSizes & {
  src: string
  width?: number
  height?: number
}

export interface DisplaySize {
  width: number
  height: number
}

export type ResolvedFile = FileResponse & {
  coverUrl: string
  previewUrl: string
  previewAttrs: ImageAttrs
  displayTitle: string
  placeholder?: string
  placeholderAspectRatio?: number
  overlayPlaceholderUrl?: string | null
  displaySize: DisplaySize
  imageAttrs: ImageAttrs
}

export interface OverlayStat {
  label: string
  icon: string
}

export interface FileLocation {
  latitude: number
  longitude: number
  label?: string
}

export interface MetadataEntry {
  key?: string
  label: string
  value: string
  icon: string
  valueIcon?: string
  valueIconLabel?: string
}

// Slider/curve primitives are editor-agnostic: both the Lightroom `crs:*`
// recipe and the LLR `llr:*` recipe render through the same panel components.
export interface RecipeAdjustmentItem {
  key: string
  label: string
  value: number
  min: number
  max: number
  digits?: number
  unit?: string
  zeroCentered?: boolean
}

export interface RecipeAdjustmentGroup {
  key: string
  label: string
  items: RecipeAdjustmentItem[]
}

export interface RecipeCurvePoint {
  x: number
  y: number
}

export interface RecipeToneCurve {
  name?: string
  composite?: RecipeCurvePoint[]
  red?: RecipeCurvePoint[]
  green?: RecipeCurvePoint[]
  blue?: RecipeCurvePoint[]
}

export interface LightroomRecipeView {
  processVersion?: string
  profile?: string
  cameraLook?: string
  whiteBalance?: string
  toneCurve?: RecipeToneCurve
  groups: RecipeAdjustmentGroup[]
}

// LLR (~/llr) writes its own XMP schema rather than Adobe's camera-raw
// settings, so its recipe carries fields Lightroom has no equivalent for
// (lens correction strength, RAW-domain denoise, the auto-selected DCP).
/**
 * One local-adjustment mask from an LLR recipe: the selection (up to four
 * analytic components combined with add / subtract / intersect) and the
 * slider deltas applied inside it.
 */
export interface LlrMaskView {
  key: string
  name?: string
  disabled: boolean
  inverted: boolean
  /** Human-readable selection, one entry per component. */
  components: string[]
  items: RecipeAdjustmentItem[]
}

export interface LlrRecipeView {
  version?: string
  /** Rendering profile (`sony`, `standard`, …). */
  profile?: string
  /** DCP / Creative Look style baked into the profile. */
  dcp?: string
  /** Sony Creative Look style code, when overridden from as-shot. */
  lookStyle?: string
  /** Creative Look tweaks, on Imaging Edge Edit's own panel scale. */
  lookItems: RecipeAdjustmentItem[]
  /** Resolved DRO state: off / auto / a level. */
  dro?: string
  denoise?: string
  aspect?: string
  /** Crop, rotation, flips and perspective, when any of them moved. */
  geometry?: string
  /** Modules explicitly bypassed in the editor. */
  bypass: string[]
  /** Camera-matching toggles that are not at their default. */
  toggles: string[]
  toneCurve?: RecipeToneCurve
  groups: RecipeAdjustmentGroup[]
  masks: LlrMaskView[]
}

export interface SocialLink {
  label: string
  url: string
  icon: string
}

export type SiteInfoPlacement = 'header' | 'waterfall'

export interface InfoEntry {
  entryType: 'info'
  displaySize: DisplaySize
}

export type WaterfallEntry = InfoEntry | (ResolvedFile & { entryType: 'file' })
