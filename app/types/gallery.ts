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

export interface LightroomAdjustmentItem {
  key: string
  label: string
  value: number
  min: number
  max: number
  digits?: number
  unit?: string
  zeroCentered?: boolean
}

export interface LightroomAdjustmentGroup {
  key: string
  label: string
  items: LightroomAdjustmentItem[]
}

export interface LightroomRecipeView {
  processVersion?: string
  profile?: string
  whiteBalance?: string
  toneCurve?: string
  groups: LightroomAdjustmentGroup[]
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
