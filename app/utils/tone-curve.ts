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
export function sampleToneCurve(points: RecipeCurvePoint[], range: number, count = 64): RecipeCurvePoint[] {
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
    }
    else if (x >= last.x) {
      y = last.y
    }
    else if (tangents) {
      while (segment < sorted.length - 2 && x > sorted[segment + 1]!.x) {
        segment += 1
      }
      const p0 = sorted[segment]!
      const p1 = sorted[segment + 1]!
      const dx = p1.x - p0.x
      const h = (x - p0.x) / dx
      const h2 = h * h
      const h3 = h2 * h
      y = p0.y * (2 * h3 - 3 * h2 + 1)
        + p1.y * (-2 * h3 + 3 * h2)
        + tangents[segment]! * dx * (h3 - 2 * h2 + h)
        + tangents[segment + 1]! * dx * (h3 - h2)
    }
    else {
      y = first.y + ((last.y - first.y) * (x - first.x)) / (last.x - first.x)
    }
    samples.push({ x, y })
  }
  return samples
}
