import type { RecomposeParams } from '../../shared/types/recompose'
import { describe, expect, it } from 'vitest'
import {
  applyHomography,
  computeFramedDims,
  computeImageQuad,
  computeRecomposePlane,
  createDefaultRecomposeParams,
  fitCropToBounds,
  isIdentityRecompose,
  recomposeCssMatrix,
  recomposeSourceScale,
  validateRecomposeParams,
} from '../../shared/utils/recompose'

const ORIGINAL = { width: 4000, height: 3000 }

function makeParams(overrides: Partial<RecomposeParams> = {}): RecomposeParams {
  return { ...createDefaultRecomposeParams(ORIGINAL), ...overrides }
}

describe('shared/utils/recompose', () => {
  it('identity params keep framed dims equal to the original', () => {
    const params = makeParams()
    expect(isIdentityRecompose(params)).toBe(true)
    expect(computeFramedDims(params)).toEqual(ORIGINAL)
    expect(recomposeSourceScale(params)).toBeCloseTo(1)
  })

  it('rotate90 swaps framed dims', () => {
    const params = makeParams({ rotate90: 1 })
    expect(computeFramedDims(params)).toEqual({ width: 3000, height: 4000 })
  })

  it('straighten expands the plane beyond the original dims', () => {
    const params = makeParams({ straighten: 10 })
    const plane = computeRecomposePlane(params)
    expect(plane.planeWidth).toBeGreaterThan(ORIGINAL.width)
    expect(plane.planeHeight).toBeGreaterThan(ORIGINAL.height)
  })

  it('stretch scales framed dims', () => {
    const params = makeParams({ stretchX: 2 })
    expect(computeFramedDims(params).width).toBe(8000)
    expect(computeFramedDims(params).height).toBe(3000)
  })

  it('crop reduces framed dims and raises source scale', () => {
    const params = makeParams({ crop: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 } })
    expect(computeFramedDims(params)).toEqual({ width: 2000, height: 1500 })
    expect(recomposeSourceScale(params)).toBeCloseTo(2)
  })

  it('fitcroptobounds keeps the crop inside the rotated image quad', () => {
    const params = makeParams({ straighten: 7 })
    const crop = fitCropToBounds(params, null)
    const plane = computeRecomposePlane(params)
    const quad = computeImageQuad(params)
    const corners = [
      { x: crop.x * plane.planeWidth, y: crop.y * plane.planeHeight },
      { x: (crop.x + crop.width) * plane.planeWidth, y: crop.y * plane.planeHeight },
      { x: (crop.x + crop.width) * plane.planeWidth, y: (crop.y + crop.height) * plane.planeHeight },
      { x: crop.x * plane.planeWidth, y: (crop.y + crop.height) * plane.planeHeight },
    ]
    for (const corner of corners) {
      let inside = true
      for (let index = 0; index < 4; index++) {
        const from = quad[index]!
        const to = quad[(index + 1) % 4]!
        const cross = (to.x - from.x) * (corner.y - from.y) - (to.y - from.y) * (corner.x - from.x)
        if (cross < -1e-6) {
          inside = false
        }
      }
      expect(inside).toBe(true)
    }
    expect(crop.width).toBeGreaterThan(0.5)
    expect(crop.height).toBeGreaterThan(0.5)
  })

  it('fitcroptobounds honors a requested aspect ratio', () => {
    const params = makeParams()
    const crop = fitCropToBounds(params, 1)
    const plane = computeRecomposePlane(params)
    const width = crop.width * plane.planeWidth
    const height = crop.height * plane.planeHeight
    expect(width / height).toBeCloseTo(1, 3)
    expect(height).toBeCloseTo(ORIGINAL.height, 0)
  })

  it('recomposecssmatrix maps the crop origin to the frame origin', () => {
    const params = makeParams({ crop: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 }, straighten: 3 })
    const plane = computeRecomposePlane(params)
    const k = 400 / (params.crop.width * plane.planeWidth)
    const matrixString = recomposeCssMatrix(params, k)
    const values = matrixString.slice('matrix3d('.length, -1).split(',').map(Number)
    // matrix3d is column-major: recover the 2D homography rows.
    const flat = [values[0]!, values[4]!, values[12]!, values[1]!, values[5]!, values[13]!, values[3]!, values[7]!, values[15]!]
    // The plane point at the crop origin comes from some wrapper-local point; instead verify
    // a known source point: the wrapper point for original pixel p is p * k.
    const source = applyHomography(plane.homography, 0, 0)
    const frame = applyHomography(flat, 0, 0)
    expect(frame.x).toBeCloseTo((source.x - params.crop.x * plane.planeWidth) * k, 4)
    expect(frame.y).toBeCloseTo((source.y - params.crop.y * plane.planeHeight) * k, 4)
  })

  it('validaterecomposeparams clamps out-of-range values', () => {
    const validated = validateRecomposeParams({
      version: 1,
      rotate90: 7,
      flipH: 'yes',
      straighten: 90,
      stretchX: 100,
      perspectiveH: -5,
      crop: { x: -1, y: 0.5, width: 2, height: 0.4 },
      original: { width: 4000.4, height: 3000 },
    })
    expect(validated).not.toBeNull()
    expect(validated!.rotate90).toBe(3)
    expect(validated!.flipH).toBe(false)
    expect(validated!.straighten).toBe(45)
    expect(validated!.stretchX).toBe(2)
    expect(validated!.perspectiveH).toBe(-1)
    expect(validated!.crop).toEqual({ x: 0, y: 0.5, width: 1, height: 0.4 })
    expect(validated!.original).toEqual({ width: 4000, height: 3000 })
  })

  it('validaterecomposeparams rejects malformed input', () => {
    expect(validateRecomposeParams(null)).toBeNull()
    expect(validateRecomposeParams({ version: 2 })).toBeNull()
    expect(validateRecomposeParams({ version: 1 })).toBeNull()
    expect(validateRecomposeParams({ version: 1, crop: {}, original: { width: 0, height: 10 } })).toBeNull()
  })
})
