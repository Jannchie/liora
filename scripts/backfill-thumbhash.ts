import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import sharp from 'sharp'
import { rgbaToThumbHash } from 'thumbhash'
import { PrismaClient } from '../app/generated/prisma/client'

interface DbFile {
  id: number
  imageUrl: string
  thumbnailUrl: string | null
  metadata: string
  title: string
}

interface ImageHashes {
  perceptualHash: string | null
  sha256: string
}

const databaseUrl = process.env.DATABASE_URL ?? `file:${join(process.cwd(), 'prisma', 'dev.db')}`
const adapter = new PrismaLibSql({ url: databaseUrl })
const prisma = new PrismaClient({ adapter })

function parseMetadata(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>
  }
  catch {
    return {}
  }
}

async function fetchImage(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      console.warn(`Skip ${url}: HTTP ${response.status}`)
      return null
    }
    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }
  catch (error) {
    console.warn(`Skip ${url}: ${String(error)}`)
    return null
  }
}

async function buildThumbhash(buffer: Buffer): Promise<string | null> {
  try {
    const pipeline = sharp(buffer).rotate()
    const metadata = await pipeline.metadata()
    const targetWidth = Math.min(100, metadata.width ?? 100)
    const targetHeight = Math.min(100, metadata.height ?? 100)

    const { data, info } = await pipeline
      .resize(targetWidth, targetHeight, { fit: 'inside', withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })

    const hash = rgbaToThumbHash(info.width, info.height, new Uint8Array(data))
    return Buffer.from(hash).toString('base64')
  }
  catch (error) {
    console.warn('Failed to build thumbhash:', error)
    return null
  }
}

async function computePerceptualHash(buffer: Buffer): Promise<string | null> {
  try {
    const { data } = await sharp(buffer)
      .rotate()
      .resize(8, 8, { fit: 'cover' })
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true })

    const pixels = new Uint8Array(data)
    const mean = pixels.reduce((sum, value) => sum + value, 0) / pixels.length
    let hash = 0n
    for (const value of pixels) {
      hash = (hash << 1n) | (value > mean ? 1n : 0n)
    }
    return hash.toString(16).padStart(16, '0')
  }
  catch (error) {
    console.warn('Failed to build perceptual hash:', error)
    return null
  }
}

async function computeHashes(buffer: Buffer): Promise<ImageHashes | null> {
  try {
    const sha256 = createHash('sha256').update(buffer).digest('hex')
    const perceptualHash = await computePerceptualHash(buffer)
    return { sha256, perceptualHash }
  }
  catch (error) {
    console.warn('Failed to compute hashes:', error)
    return null
  }
}

async function updateFileThumbhash(file: DbFile): Promise<boolean> {
  const metadata = parseMetadata(file.metadata)
  const hasThumbhash = typeof metadata.thumbhash === 'string' && metadata.thumbhash.trim().length > 0
  const hasPerceptualHash = typeof metadata.perceptualHash === 'string' && metadata.perceptualHash.trim().length > 0
  const hasSha256 = typeof metadata.sha256 === 'string' && metadata.sha256.trim().length > 0

  if (hasThumbhash && hasPerceptualHash && hasSha256) {
    return false
  }

  const sourceUrl = (file.thumbnailUrl?.trim() || file.imageUrl || '').trim()
  if (!sourceUrl) {
    console.warn(`File #${file.id} has no usable image URL`)
    return false
  }

  const imageBuffer = await fetchImage(sourceUrl)
  if (!imageBuffer) {
    return false
  }

  const thumbhash = hasThumbhash ? (metadata.thumbhash as string) : await buildThumbhash(imageBuffer)
  const hashes = !hasPerceptualHash || !hasSha256 ? await computeHashes(imageBuffer) : null

  let changed = false
  if (!hasThumbhash && thumbhash) {
    metadata.thumbhash = thumbhash
    changed = true
  }
  if (!hasPerceptualHash && hashes?.perceptualHash) {
    metadata.perceptualHash = hashes.perceptualHash
    changed = true
  }
  if (!hasSha256 && hashes?.sha256) {
    metadata.sha256 = hashes.sha256
    changed = true
  }

  if (!changed) {
    return false
  }

  await prisma.file.update({
    where: { id: file.id },
    data: { metadata: JSON.stringify(metadata) },
  })

  console.log(`Updated #${file.id} (${file.title || 'untitled'})`)
  return true
}

async function main(): Promise<void> {
  const files = await prisma.file.findMany({ orderBy: { id: 'asc' } })
  let updatedCount = 0

  for (const file of files) {
    const changed = await updateFileThumbhash(file)
    if (changed) {
      updatedCount += 1
    }
  }

  console.log(`Backfill complete. Added thumbhash for ${updatedCount} of ${files.length} records.`)
}

try {
  await main()
}
catch (error) {
  console.error('Backfill failed:', error)
  process.exitCode = 1
}
finally {
  await prisma.$disconnect()
}
