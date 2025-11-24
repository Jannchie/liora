import type { HistogramData } from '~/types/file'
import sharp from 'sharp'

/**
 * Compute normalized RGB and luminance histograms for an image buffer.
 */
export async function computeHistogram(data: Buffer): Promise<HistogramData | null> {
  try {
    const { data: raw, info } = await sharp(data)
      .rotate()
      .resize(256, 256, { fit: 'inside', withoutEnlargement: true })
      .raw()
      .toBuffer({ resolveWithObject: true })

    const { width, height, channels } = info
    if (!width || !height || !channels) {
      return null
    }

    const histogram: HistogramData = {
      red: Array.from({ length: 256 }, () => 0),
      green: Array.from({ length: 256 }, () => 0),
      blue: Array.from({ length: 256 }, () => 0),
      luminance: Array.from({ length: 256 }, () => 0),
    }

    for (let index = 0; index < raw.length; index += channels) {
      const red = raw[index] ?? 0
      const green = raw[index + 1] ?? red
      const blue = raw[index + 2] ?? green

      histogram.red[red] += 1
      histogram.green[green] += 1
      histogram.blue[blue] += 1

      const luminance = Math.min(255, Math.max(0, Math.round(0.299 * red + 0.587 * green + 0.114 * blue)))
      histogram.luminance[luminance] += 1
    }

    const pixelCount = width * height
    if (pixelCount > 0) {
      for (const channel of Object.values(histogram)) {
        for (let index = 0; index < channel.length; index += 1) {
          channel[index] = Number(channel[index] / pixelCount)
        }
      }
    }

    return histogram
  }
  catch (error) {
    console.warn('Histogram generation failed:', error)
    return null
  }
}
