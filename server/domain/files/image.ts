import type { MultipartEntry } from './upload'
import { createHash } from 'node:crypto'
import { createError } from 'h3'
import sharp from 'sharp'
import { encodeArthashFromRgb } from '../../utils/arthash'

const FORMAT_MIME_MAP: Record<string, string> = {
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  tiff: 'image/tiff',
  tif: 'image/tiff',
  gif: 'image/gif',
  svg: 'image/svg+xml',
}

export function resolveContentType(format: string | undefined, fallback: string | undefined): string | undefined {
  const normalized = format?.toLowerCase()
  if (normalized && FORMAT_MIME_MAP[normalized]) {
    return FORMAT_MIME_MAP[normalized]
  }
  const fallbackType = fallback?.trim()
  return fallbackType && fallbackType.length > 0 ? fallbackType : undefined
}

export async function validateImage(file: MultipartEntry): Promise<{ width: number, height: number, contentType?: string }> {
  try {
    const metadata = await sharp(file.data).metadata()
    const width = metadata.width ?? 0
    const height = metadata.height ?? 0
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid image dimensions.' })
    }
    return { width, height, contentType: resolveContentType(metadata.format, file.type) }
  }
  catch (error) {
    console.warn('Image validation failed:', error)
    throw createError({ statusCode: 400, statusMessage: 'Invalid image file.' })
  }
}

export async function computePerceptualHash(data: Buffer): Promise<string | null> {
  try {
    const { data: raw } = await sharp(data)
      .rotate()
      .resize(8, 8, { fit: 'cover' })
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true })
    const pixels = new Uint8Array(raw)
    const mean = pixels.reduce((sum, value) => sum + value, 0) / pixels.length
    let nibble = 0
    let hex = ''
    for (const [index, pixel] of pixels.entries()) {
      nibble = (nibble << 1) | (pixel > mean ? 1 : 0)
      if ((index + 1) % 4 === 0) {
        hex += nibble.toString(16)
        nibble = 0
      }
    }
    if (pixels.length % 4 !== 0) {
      nibble <<= 4 - (pixels.length % 4)
      hex += nibble.toString(16)
    }
    return hex.padStart(16, '0')
  }
  catch (error) {
    console.warn('Perceptual hash generation failed:', error)
    return null
  }
}

export async function generateArthash(data: Buffer): Promise<string | null> {
  try {
    const pipeline = sharp(data).rotate()
    const metadata = await pipeline.metadata()
    const targetWidth = Math.min(100, metadata.width ?? 100)
    const targetHeight = Math.min(100, metadata.height ?? 100)
    const { data: raw, info } = await pipeline
      .resize(targetWidth, targetHeight, { fit: 'inside', withoutEnlargement: true })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    const hash = await encodeArthashFromRgb(new Uint8Array(raw), info.width, info.height)
    return Buffer.from(hash).toString('base64')
  }
  catch (error) {
    console.warn('Arthash generation failed:', error)
    return null
  }
}

export function computeSha256(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex')
}
