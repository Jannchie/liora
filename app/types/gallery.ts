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
export interface LlrRecipeView {
  version?: string
  profile?: string
  denoise?: string
  aspect?: string
  toneCurve?: RecipeToneCurve
  groups: RecipeAdjustmentGroup[]
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
