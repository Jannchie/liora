import type { RecomposeCropRect, RecomposeParams, RecomposePlane } from '../types/recompose'

/** Keystone strength at |perspectiveH/V| = 1, kept < 0.5 so the projective divide never crosses zero. */
const PERSPECTIVE_STRENGTH = 0.4
const MIN_CROP_SIZE = 0.01
const MAX_STRAIGHTEN = 45
const MIN_STRETCH = 0.5
const MAX_STRETCH = 2

const DEFAULT_RECOMPOSE_CROP: RecomposeCropRect = { x: 0, y: 0, width: 1, height: 1 }

/** Clamps a crop rect into the unit square with a minimum size per axis. */
export function clampCropRect(crop: RecomposeCropRect, minSize: number = MIN_CROP_SIZE): RecomposeCropRect {
  const width = Math.min(1, Math.max(minSize, crop.width))
  const height = Math.min(1, Math.max(minSize, crop.height))
  return {
    x: Math.min(1 - width, Math.max(0, crop.x)),
    y: Math.min(1 - height, Math.max(0, crop.y)),
    width,
    height,
  }
}

export function createDefaultRecomposeParams(original: { width: number, height: number }): RecomposeParams {
  return {
    version: 1,
    rotate90: 0,
    flipH: false,
    flipV: false,
    straighten: 0,
    stretchX: 1,
    stretchY: 1,
    perspectiveH: 0,
    perspectiveV: 0,
    crop: { ...DEFAULT_RECOMPOSE_CROP },
    original: { width: original.width, height: original.height },
  }
}

export function isIdentityRecompose(params: RecomposeParams): boolean {
  return params.rotate90 === 0
    && !params.flipH
    && !params.flipV
    && params.straighten === 0
    && params.stretchX === 1
    && params.stretchY === 1
    && params.perspectiveH === 0
    && params.perspectiveV === 0
    && params.crop.x === 0
    && params.crop.y === 0
    && params.crop.width === 1
    && params.crop.height === 1
}

type Mat3 = number[]

function multiply(a: Mat3, b: Mat3): Mat3 {
  const out = Array.from<number>({ length: 9 }).fill(0)
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      out[row * 3 + col] = a[row * 3]! * b[col]! + a[row * 3 + 1]! * b[3 + col]! + a[row * 3 + 2]! * b[6 + col]!
    }
  }
  return out
}

function translation(tx: number, ty: number): Mat3 {
  return [1, 0, tx, 0, 1, ty, 0, 0, 1]
}

function scaling(sx: number, sy: number): Mat3 {
  return [sx, 0, 0, 0, sy, 0, 0, 0, 1]
}

function rotation(degrees: number): Mat3 {
  const radians = (degrees * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return [cos, -sin, 0, sin, cos, 0, 0, 0, 1]
}

export function applyHomography(matrix: Mat3, x: number, y: number): { x: number, y: number } {
  const w = matrix[6]! * x + matrix[7]! * y + matrix[8]!
  return {
    x: (matrix[0]! * x + matrix[1]! * y + matrix[2]!) / w,
    y: (matrix[3]! * x + matrix[4]! * y + matrix[5]!) / w,
  }
}

/**
 * Homography from original display-pixel coordinates to the composed plane
 * (translated so the transformed image's bounding box starts at 0,0).
 * Pipeline (right to left): center → flip → rotate90 → perspective → straighten → stretch.
 */
export function computeRecomposePlane(params: RecomposeParams): RecomposePlane {
  const w0 = params.original.width
  const h0 = params.original.height
  const rotatedHalfW = (params.rotate90 % 2 === 0 ? w0 : h0) / 2
  const rotatedHalfH = (params.rotate90 % 2 === 0 ? h0 : w0) / 2
  const gx = (params.perspectiveH * PERSPECTIVE_STRENGTH) / rotatedHalfW
  const gy = (params.perspectiveV * PERSPECTIVE_STRENGTH) / rotatedHalfH
  const perspective: Mat3 = [1, 0, 0, 0, 1, 0, gx, gy, 1]

  let matrix = translation(-w0 / 2, -h0 / 2)
  matrix = multiply(scaling(params.flipH ? -1 : 1, params.flipV ? -1 : 1), matrix)
  matrix = multiply(rotation(params.rotate90 * 90), matrix)
  matrix = multiply(perspective, matrix)
  matrix = multiply(rotation(params.straighten), matrix)
  matrix = multiply(scaling(params.stretchX, params.stretchY), matrix)

  const corners = [
    applyHomography(matrix, 0, 0),
    applyHomography(matrix, w0, 0),
    applyHomography(matrix, w0, h0),
    applyHomography(matrix, 0, h0),
  ]
  const minX = Math.min(...corners.map(corner => corner.x))
  const minY = Math.min(...corners.map(corner => corner.y))
  const maxX = Math.max(...corners.map(corner => corner.x))
  const maxY = Math.max(...corners.map(corner => corner.y))
  return {
    homography: multiply(translation(-minX, -minY), matrix),
    planeWidth: maxX - minX,
    planeHeight: maxY - minY,
  }
}

export function computeFramedDims(params: RecomposeParams): { width: number, height: number } {
  const plane = computeRecomposePlane(params)
  return {
    width: Math.max(1, Math.round(params.crop.width * plane.planeWidth)),
    height: Math.max(1, Math.round(params.crop.height * plane.planeHeight)),
  }
}

/** How much wider than the frame the original must be fetched to fill it 1:1. */
export function recomposeSourceScale(params: RecomposeParams): number {
  const plane = computeRecomposePlane(params)
  return params.original.width / (params.crop.width * plane.planeWidth)
}

/**
 * Request size for the ORIGINAL image so a frame displayed at `targetWidth`
 * CSS pixels renders 1:1, capped at the original's own resolution.
 */
export function recomposeSourceSize(params: RecomposeParams, targetWidth: number): { width: number, height: number } {
  const width = Math.min(
    params.original.width,
    Math.max(1, Math.ceil(targetWidth * recomposeSourceScale(params))),
  )
  const height = Math.max(1, Math.round((width * params.original.height) / params.original.width))
  return { width, height }
}

/**
 * CSS matrix3d mapping a wrapper element of size (original.width * k) x (original.height * k)
 * onto the frame box, where k = frameCssWidth / (crop.width * planeWidth).
 * Requires `transform-origin: 0 0` on the wrapper.
 */
export function recomposeCssMatrix(params: RecomposeParams, k: number): string {
  const plane = computeRecomposePlane(params)
  let matrix = multiply(plane.homography, scaling(1 / k, 1 / k))
  matrix = multiply(translation(-params.crop.x * plane.planeWidth, -params.crop.y * plane.planeHeight), matrix)
  matrix = multiply(scaling(k, k), matrix)
  const normalizer = matrix[8]!
  const [a, b, c, d, e, f, g, h] = matrix.map(value => value / normalizer)
  return `matrix3d(${a}, ${d}, 0, ${g}, ${b}, ${e}, 0, ${h}, 0, 0, 1, 0, ${c}, ${f}, 0, 1)`
}

function isPointInConvexQuad(quad: Array<{ x: number, y: number }>, x: number, y: number): boolean {
  let sign = 0
  for (let index = 0; index < 4; index++) {
    const from = quad[index]!
    const to = quad[(index + 1) % 4]!
    const cross = (to.x - from.x) * (y - from.y) - (to.y - from.y) * (x - from.x)
    if (cross === 0) {
      continue
    }
    const current = cross > 0 ? 1 : -1
    if (sign === 0) {
      sign = current
    }
    else if (sign !== current) {
      return false
    }
  }
  return true
}

/** The transformed image as a convex quad in plane coordinates. */
export function computeImageQuad(params: RecomposeParams): Array<{ x: number, y: number }> {
  const plane = computeRecomposePlane(params)
  const w0 = params.original.width
  const h0 = params.original.height
  return [
    applyHomography(plane.homography, 0, 0),
    applyHomography(plane.homography, w0, 0),
    applyHomography(plane.homography, w0, h0),
    applyHomography(plane.homography, 0, h0),
  ]
}

/**
 * Largest crop rect fully inside the transformed image quad, centered at the current
 * crop's center (clamped into the quad's bounding box). `aspect` is width/height in
 * plane pixels; null keeps the current crop's aspect.
 */
export function fitCropToBounds(params: RecomposeParams, aspect: number | null): RecomposeCropRect {
  const plane = computeRecomposePlane(params)
  const quad = computeImageQuad(params)
  const pw = plane.planeWidth
  const ph = plane.planeHeight
  const currentAspect = (params.crop.width * pw) / (params.crop.height * ph)
  const targetAspect = aspect ?? (Number.isFinite(currentAspect) && currentAspect > 0 ? currentAspect : pw / ph)
  const centerX = Math.min(pw, Math.max(0, (params.crop.x + params.crop.width / 2) * pw))
  const centerY = Math.min(ph, Math.max(0, (params.crop.y + params.crop.height / 2) * ph))

  const baseHalfH = Math.max(ph, pw / targetAspect) / 2
  const baseHalfW = baseHalfH * targetAspect

  const fits = (scale: number): boolean => {
    const halfW = baseHalfW * scale
    const halfH = baseHalfH * scale
    return isPointInConvexQuad(quad, centerX - halfW, centerY - halfH)
      && isPointInConvexQuad(quad, centerX + halfW, centerY - halfH)
      && isPointInConvexQuad(quad, centerX + halfW, centerY + halfH)
      && isPointInConvexQuad(quad, centerX - halfW, centerY + halfH)
  }

  let low = 0
  let high = 1
  for (let iteration = 0; iteration < 48; iteration++) {
    const mid = (low + high) / 2
    if (fits(mid)) {
      low = mid
    }
    else {
      high = mid
    }
  }

  const halfW = Math.max((MIN_CROP_SIZE / 2) * pw, baseHalfW * low)
  const halfH = Math.max((MIN_CROP_SIZE / 2) * ph, baseHalfH * low)
  return {
    x: (centerX - halfW) / pw,
    y: (centerY - halfH) / ph,
    width: (halfW * 2) / pw,
    height: (halfH * 2) / ph,
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function toFiniteNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Validates and range-clamps untrusted params. Returns null when the input is not a
 * plausible RecomposeParams object.
 */
export function validateRecomposeParams(input: unknown): RecomposeParams | null {
  if (typeof input !== 'object' || input === null) {
    return null
  }
  const candidate = input as Record<string, unknown>
  if (candidate.version !== 1) {
    return null
  }
  const crop = candidate.crop as Record<string, unknown> | undefined
  const original = candidate.original as Record<string, unknown> | undefined
  if (typeof crop !== 'object' || crop === null || typeof original !== 'object' || original === null) {
    return null
  }
  const originalWidth = toFiniteNumber(original.width)
  const originalHeight = toFiniteNumber(original.height)
  if (!originalWidth || !originalHeight || originalWidth < 1 || originalHeight < 1) {
    return null
  }
  const cropWidth = toFiniteNumber(crop.width)
  const cropHeight = toFiniteNumber(crop.height)
  const cropX = toFiniteNumber(crop.x)
  const cropY = toFiniteNumber(crop.y)
  if (cropWidth === null || cropHeight === null || cropX === null || cropY === null) {
    return null
  }
  const rotate90 = toFiniteNumber(candidate.rotate90)
  return {
    version: 1,
    rotate90: (((rotate90 === null ? 0 : Math.round(rotate90)) % 4 + 4) % 4) as RecomposeParams['rotate90'],
    flipH: candidate.flipH === true,
    flipV: candidate.flipV === true,
    straighten: clamp(toFiniteNumber(candidate.straighten) ?? 0, -MAX_STRAIGHTEN, MAX_STRAIGHTEN),
    stretchX: clamp(toFiniteNumber(candidate.stretchX) ?? 1, MIN_STRETCH, MAX_STRETCH),
    stretchY: clamp(toFiniteNumber(candidate.stretchY) ?? 1, MIN_STRETCH, MAX_STRETCH),
    perspectiveH: clamp(toFiniteNumber(candidate.perspectiveH) ?? 0, -1, 1),
    perspectiveV: clamp(toFiniteNumber(candidate.perspectiveV) ?? 0, -1, 1),
    crop: clampCropRect({ x: cropX, y: cropY, width: cropWidth, height: cropHeight }),
    original: {
      width: Math.round(originalWidth),
      height: Math.round(originalHeight),
    },
  }
}
