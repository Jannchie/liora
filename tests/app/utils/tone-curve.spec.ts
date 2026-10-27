import { describe, expect, it } from 'vitest'
import { sampleToneCurve } from '../../../app/utils/tone-curve'

describe('app/utils/tone-curve', () => {
  it('passes through every control point', () => {
    const points = [
      { x: 0, y: 0.025 },
      { x: 0.25, y: 0.26 },
      { x: 0.5, y: 0.52 },
      { x: 0.75, y: 0.78 },
      { x: 1, y: 0.985 },
    ]
    const samples = sampleToneCurve(points, 1, 4)
    for (const [index, point] of points.entries()) {
      expect(samples[index]?.y).toBeCloseTo(point.y)
    }
  })

  it('bends smoothly between points instead of joining them with lines', () => {
    const samples = sampleToneCurve(
      [
        { x: 0, y: 0 },
        { x: 0.25, y: 0.1 },
        { x: 1, y: 1 },
      ],
      1,
      8,
    )
    const linear = 0.1 + ((1 - 0.1) * (0.5 - 0.25)) / 0.75
    expect(samples[4]?.y).not.toBeCloseTo(linear, 2)
  })

  it('stays monotone and flat beyond the end points', () => {
    const samples = sampleToneCurve(
      [
        { x: 64, y: 0 },
        { x: 128, y: 200 },
        { x: 192, y: 255 },
      ],
      255,
    )
    expect(samples[0]?.y).toBe(0)
    expect(samples.at(-1)?.y).toBe(255)
    for (let index = 1; index < samples.length; index += 1) {
      expect(samples[index]!.y).toBeGreaterThanOrEqual(samples[index - 1]!.y - 1e-9)
    }
  })
})
