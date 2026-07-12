export interface RecomposeCropRect {
  /** Normalized 0..1 in composed-plane coordinates. */
  x: number
  y: number
  width: number
  height: number
}

export interface RecomposeOriginalSize {
  /** Display-oriented dimensions of the stored original. */
  width: number
  height: number
}

export interface RecomposeParams {
  version: 1
  /** Counter-clockwise 90° steps applied after flip. */
  rotate90: 0 | 1 | 2 | 3
  flipH: boolean
  flipV: boolean
  /** Degrees, -45..45. */
  straighten: number
  /** 0.5..2, 1 = none. */
  stretchX: number
  stretchY: number
  /** Dimensionless keystone amount, -1..1. */
  perspectiveH: number
  perspectiveV: number
  crop: RecomposeCropRect
  original: RecomposeOriginalSize
}

export interface RecomposePlane {
  /** Row-major 3x3 homography from original display pixels to plane pixels. */
  homography: number[]
  planeWidth: number
  planeHeight: number
}
