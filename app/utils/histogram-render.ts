import type { HistogramData } from '~/types/file'

// Canvas drawing for the viewer's histogram, ported from LLR's own
// (apps/web/src/rendering/histogram.ts) so a frame reads the same here as it
// did in the editor: RGB as filled areas composited additively, luminance as
// a thin line on top, a square-root axis, and channel-aware clipping
// triangles in the corners.
//
// Liora stores each channel normalised to fractions of the pixel count, not
// raw counts. Everything below is scale-invariant except the clipping
// threshold, which is therefore a plain fraction.

// An edge bin must hold more than this share of the pixels before its
// clipping indicator lights — a few true blacks / speculars are normal.
const CLIP_FRACTION = 0.0002

// Additive channel colours: with the "lighter" composite, R+G → yellow and
// all three → white, the way real light overlaps.
const COLOR_RED = '#e1373c'
const COLOR_GREEN = '#46be55'
const COLOR_BLUE = '#466eeb'

const BACKGROUND = '#0c0c0c'
const GRID = '#1a1a1a'
const LUMINANCE = '#d8d8d8'

function at(values: number[], index: number): number {
  const value = values[index]
  return value !== undefined && Number.isFinite(value) ? value : 0
}

/**
 * Peak over the inner bins (1–254). A black or blown background piles an
 * enormous count into the edge bins that would flatten every other tone;
 * those bars are drawn clamped to the top instead of setting the scale.
 */
export function robustMax(data: HistogramData): number {
  let max = 0
  for (let index = 1; index < 255; index += 1) {
    max = Math.max(max, at(data.red, index), at(data.green, index), at(data.blue, index), at(data.luminance, index))
  }
  return max > 0 ? max : 1
}

/** Bin value → [0, 1] bar height on a square-root axis. */
export function sqrtScaler(max: number): (value: number) => number {
  return value => (value <= 0 ? 0 : Math.sqrt(Math.min(1, value / max)))
}

/**
 * Indicator colour per edge, or null below threshold. The colour names the
 * railed channels (white = all three, yellow = R+G, …), so a single channel
 * saturating reads differently from overall over / under-exposure.
 */
export function clipIndicators(data: HistogramData): { shadow: string | null; highlight: string | null } {
  let total = 0
  for (let index = 0; index < 256; index += 1) {
    total += at(data.luminance, index)
  }
  const threshold = total * CLIP_FRACTION
  const color = (red: number, green: number, blue: number): string | null => {
    const r = red > threshold
    const g = green > threshold
    const b = blue > threshold
    if (!r && !g && !b) {
      return null
    }
    return `rgb(${r ? 255 : 0}, ${g ? 255 : 0}, ${b ? 255 : 0})`
  }
  return {
    shadow: total > 0 ? color(at(data.red, 0), at(data.green, 0), at(data.blue, 0)) : null,
    highlight: total > 0 ? color(at(data.red, 255), at(data.green, 255), at(data.blue, 255)) : null,
  }
}

export function drawHistogram(ctx: CanvasRenderingContext2D, width: number, height: number, data: HistogramData): void {
  const scale = sqrtScaler(robustMax(data))
  const step = width / 256

  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = BACKGROUND
  ctx.fillRect(0, 0, width, height)

  // Quarter-tone guides.
  ctx.strokeStyle = GRID
  ctx.lineWidth = 0.5
  for (const fraction of [0.25, 0.5, 0.75]) {
    const x = fraction * width
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
    ctx.stroke()
  }

  ctx.globalCompositeOperation = 'lighter'
  const fillChannel = (values: number[], color: string): void => {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(0, height)
    for (let index = 0; index < 256; index += 1) {
      ctx.lineTo(index * step, height - scale(at(values, index)) * height)
    }
    ctx.lineTo(width, height)
    ctx.closePath()
    ctx.fill()
  }
  fillChannel(data.red, COLOR_RED)
  fillChannel(data.green, COLOR_GREEN)
  fillChannel(data.blue, COLOR_BLUE)
  ctx.globalCompositeOperation = 'source-over'

  ctx.globalAlpha = 0.85
  ctx.strokeStyle = LUMINANCE
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let index = 0; index < 256; index += 1) {
    ctx.lineTo(index * step, height - scale(at(data.luminance, index)) * height)
  }
  ctx.stroke()
  ctx.globalAlpha = 1

  const { shadow, highlight } = clipIndicators(data)
  if (shadow) {
    ctx.fillStyle = shadow
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(10, 0)
    ctx.lineTo(0, 10)
    ctx.closePath()
    ctx.fill()
  }
  if (highlight) {
    ctx.fillStyle = highlight
    ctx.beginPath()
    ctx.moveTo(width, 0)
    ctx.lineTo(width - 10, 0)
    ctx.lineTo(width, 10)
    ctx.closePath()
    ctx.fill()
  }
}
