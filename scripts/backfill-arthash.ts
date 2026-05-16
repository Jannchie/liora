import type { FileRow } from '../server/utils/db'
import { createHash } from 'node:crypto'
import { asc, eq } from 'drizzle-orm'
import sharp from 'sharp'
import { encodeArthashFromRgb, ensureArthashReady } from '../server/utils/arthash'
import { closeDb, db, files as filesTable } from '../server/utils/db'

type DbFile = Pick<FileRow, 'id' | 'imageUrl' | 'metadata' | 'title'>

interface ImageHashes {
  perceptualHash: string | null
  sha256: string
}

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

async function buildArthash(buffer: Buffer): Promise<string | null> {
  try {
    const pipeline = sharp(buffer).rotate()
    const metadata = await pipeline.metadata()
    const targetWidth = Math.min(100, metadata.width ?? 100)
    const targetHeight = Math.min(100, metadata.height ?? 100)

    const { data, info } = await pipeline
      .resize(targetWidth, targetHeight, { fit: 'inside', withoutEnlargement: true })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })

    const hash = await encodeArthashFromRgb(new Uint8Array(data), info.width, info.height)
    return Buffer.from(hash).toString('base64')
  }
  catch (error) {
    console.warn('Failed to build arthash:', error)
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

async function updateFileArthash(file: DbFile): Promise<boolean> {
  const metadata = parseMetadata(file.metadata)
  const hasArthash = typeof metadata.arthash === 'string' && metadata.arthash.trim().length > 0
  const hasPerceptualHash = typeof metadata.perceptualHash === 'string' && metadata.perceptualHash.trim().length > 0
  const hasSha256 = typeof metadata.sha256 === 'string' && metadata.sha256.trim().length > 0

  if (hasArthash && hasPerceptualHash && hasSha256) {
    return false
  }

  const sourceUrl = file.imageUrl?.trim() ?? ''
  if (!sourceUrl) {
    console.warn(`File #${file.id} has no usable image URL`)
    return false
  }

  const imageBuffer = await fetchImage(sourceUrl)
  if (!imageBuffer) {
    return false
  }

  const arthash = hasArthash ? (metadata.arthash as string) : await buildArthash(imageBuffer)
  const hashes = !hasPerceptualHash || !hasSha256 ? await computeHashes(imageBuffer) : null

  let changed = false
  if (!hasArthash && arthash) {
    metadata.arthash = arthash
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

  await db
    .update(filesTable)
    .set({ metadata: JSON.stringify(metadata) })
    .where(eq(filesTable.id, file.id))

  console.log(`Updated #${file.id} (${file.title || 'untitled'})`)
  return true
}

async function main(): Promise<void> {
  await ensureArthashReady()
  const files = await db.query.files.findMany({
    orderBy: [asc(filesTable.id)],
  })
  let updatedCount = 0

  for (const file of files) {
    const changed = await updateFileArthash(file)
    if (changed) {
      updatedCount += 1
    }
  }

  console.log(`Backfill complete. Added arthash for ${updatedCount} of ${files.length} records.`)
}

try {
  await main()
}
catch (error) {
  console.error('Backfill failed:', error)
  process.exitCode = 1
}
finally {
  await closeDb()
}
