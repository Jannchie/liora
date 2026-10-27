import type { RecipeCurvePoint } from '~/types/gallery'

// Point curves are drawn the way the editors evaluate them: a monotone cubic
// Hermite spline through the control points (Fritsch–Carlson tangents, as in
// LLR's `curveToLUT`), flat beyond the end points. Joining the points with
// straight segments shows kinks the image never has.

/** Fritsch–Carlson monotone tangents, one per knot. */
function splineTangents(points: RecipeCurvePoint[]): number[] {
  const n = points.length
  const secants: number[] = []
  for (let index = 0; index < n - 1; index += 1) {
    const dx = points[index + 1]!.x - points[index]!.x
    secants.push(dx > 1e-9 ? (points[index + 1]!.y - points[index]!.y) / dx : 0)
  }
  const tangents = Array.from<number>({ length: n }).fill(0)
  tangents[0] = secants[0]!
  tangents[n - 1] = secants[n - 2]!
  for (let index = 1; index < n - 1; index += 1) {
    const s0 = secants[index - 1]!
    const s1 = secants[index]!
    if (s0 * s1 <= 0) {
      continue
    }
    const w0 = 2 * s1 + s0
    const w1 = s1 + 2 * s0
    const denominator = w0 * s0 + w1 * s1
    tangents[index] = Math.abs(denominator) > 1e-9 ? (s0 * s1 * (w0 + w1)) / denominator : 0
  }
  return tangents
}

/**
 * The curve evaluated at `count + 1` evenly spaced inputs across
 * `[0, range]`, in the points' own units.
 */
export function sampleToneCurve(points: RecipeCurvePoint[], range: number, count = 128): RecipeCurvePoint[] {
  const sorted = points.toSorted((a, b) => a.x - b.x)
  if (sorted.length < 2) {
    return sorted
  }
  const first = sorted[0]!
  const last = sorted.at(-1)!
  const tangents = sorted.length > 2 ? splineTangents(sorted) : null
  const samples: RecipeCurvePoint[] = []
  let segment = 0
  for (let step = 0; step <= count; step += 1) {
    const x = (step / count) * range
    let y: number
    if (x <= first.x) {
      y = first.y
    } else if (x >= last.x) {
      y = last.y
    } else if (tangents) {
      while (segment < sorted.length - 2 && x > sorted[segment + 1]!.x) {
        segment += 1
      }
      const p0 = sorted[segment]!
      const p1 = sorted[segment + 1]!
      const dx = p1.x - p0.x
      const h = (x - p0.x) / dx
      const h2 = h * h
      const h3 = h2 * h
      y =
        p0.y * (2 * h3 - 3 * h2 + 1) +
        p1.y * (-2 * h3 + 3 * h2) +
        tangents[segment]! * dx * (h3 - 2 * h2 + h) +
        tangents[segment + 1]! * dx * (h3 - h2)
    } else {
      y = first.y + ((last.y - first.y) * (x - first.x)) / (last.x - first.x)
    }
    samples.push({ x, y: Math.min(range, Math.max(0, y)) })
  }
  return samples
}

/** LLR's parametric (region) curve: four region amounts and three splits. */
export interface ParametricCurve {
  shadows: number
  darks: number
  lights: number
  highlights: number
  shadowSplit: number
  midtoneSplit: number
  highlightSplit: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * The parametric curve at `count + 1` evenly spaced inputs across
 * `[0, range]`. A port of LLR's `parametricToLUT` (rendering/curve.ts), which
 * approximates Lightroom's region curve with Gaussian bumps centred in each
 * region, re-anchored at both ends and forced monotone — the curve LLR itself
 * draws and renders with.
 */
export function sampleParametricCurve(curve: ParametricCurve, range: number, count = 128): RecipeCurvePoint[] {
  const splits = [curve.shadowSplit, curve.midtoneSplit, curve.highlightSplit]
    .map(split => clamp(split / 100, 0.02, 0.98))
    .toSorted((a, b) => a - b)
  const [s1, s2, s3] = splits as [number, number, number]
  const centers = [s1 * 0.5, (s1 + s2) / 2, (s2 + s3) / 2, (s3 + 1) / 2]
  const amounts = [curve.shadows, curve.darks, curve.lights, curve.highlights].map(value => clamp(value / 100, -1, 1))
  const sigmas = centers.map((center, index) => {
    const previous = index > 0 ? centers[index - 1]! : 0
    const next = index < 3 ? centers[index + 1]! : 1
    return clamp(Math.min(center - previous, next - center) * 0.85, 0.05, 0.3)
  })
  // ±100 moves the output about ±0.22 at the region's peak.
  const amplitude = 0.22
  const displacement = (x: number): number => {
    let total = 0
    for (const [index, center] of centers.entries()) {
      const z = (x - center) / sigmas[index]!
      total += amounts[index]! * Math.exp(-0.5 * z * z)
    }
    return amplitude * total
  }
  const d0 = displacement(0)
  const d1 = displacement(1)
  const samples: RecipeCurvePoint[] = []
  let floor = 0
  for (let step = 0; step <= count; step += 1) {
    const x = step / count
    const y = Math.max(floor, clamp(x + displacement(x) - (d0 * (1 - x) + d1 * x), 0, 1))
    floor = y
    samples.push({ x: x * range, y: y * range })
  }
  return samples
}
