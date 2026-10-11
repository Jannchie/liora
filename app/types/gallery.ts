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
  /** Draw the track as the quantity's own scale: a hue wheel or a Kelvin ramp. */
  track?: 'hue' | 'temperature'
}

export interface RecipeAdjustmentGroup {
  key: string
  label: string
  items: RecipeAdjustmentItem[]
  /** Switched off in the editor: the values are kept but not rendered. */
  bypassed?: boolean
}

/** One non-slider setting of a recipe (profile, DRO, geometry…), as a key / value row. */
export interface RecipeFact {
  key: string
  label: string
  value: string
  bypassed?: boolean
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
  /** `llr:Version`, the export schema version. */
  version?: string
  /** Profile, camera style, look, DRO, denoise, framing, erase — whatever is set. */
  facts: RecipeFact[]
  /** Camera-matching toggles that are not at their default. */
  toggles: string[]
  toneCurve?: RecipeToneCurve
  toneCurveBypassed: boolean
  groups: RecipeAdjustmentGroup[]
  masks: LlrMaskView[]
  masksBypassed: boolean
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
