import type { HistogramData } from '../../../app/types/file'
import { describe, expect, it } from 'vitest'
import { clipIndicators, robustMax, sqrtScaler } from '../../../app/utils/histogram-render'

function flat(value = 0): number[] {
  return Array.from<number>({ length: 256 }).fill(value)
}

function histogram(overrides: Partial<HistogramData> = {}): HistogramData {
  return { red: flat(), green: flat(), blue: flat(), luminance: flat(), ...overrides }
}

describe('robustmax', () => {
  it('ignores the clipping bins so a black background does not flatten the plot', () => {
    const luminance = flat(0.001)
    luminance[0] = 0.9
    luminance[128] = 0.01
    expect(robustMax(histogram({ luminance }))).toBe(0.01)
  })

  it('falls back to 1 for an empty histogram', () => {
    expect(robustMax(histogram())).toBe(1)
  })
})

describe('sqrtscaler', () => {
  it('maps onto a square-root axis and clamps above the peak', () => {
    const scale = sqrtScaler(0.04)
    expect(scale(0)).toBe(0)
    expect(scale(0.01)).toBeCloseTo(0.5)
    expect(scale(0.2)).toBe(1)
  })
})

describe('clipindicators', () => {
  it('stays dark when the edge bins hold only a trace of pixels', () => {
    const luminance = flat(1 / 256)
    const red = flat()
    red[128] = 0.5
    red[255] = 0.00001
    expect(clipIndicators(histogram({ luminance, red }))).toEqual({ shadow: null, highlight: null })
  })

  it('names the railed channels by colour', () => {
    const luminance = flat(1 / 256)
    const red = flat()
    const green = flat()
    const blue = flat()
    red[255] = 0.05
    green[255] = 0.05
    for (const channel of [red, green, blue]) {
      channel[0] = 0.05
    }
    expect(clipIndicators(histogram({ luminance, red, green, blue }))).toEqual({
      shadow: 'rgb(255, 255, 255)',
      highlight: 'rgb(255, 255, 0)',
    })
  })
})
