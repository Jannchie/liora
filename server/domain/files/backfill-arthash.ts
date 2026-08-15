import { asc, eq } from 'drizzle-orm'
import { db, files } from '../../utils/db'
import { logger } from '../../utils/logger'
import { computePerceptualHash, computeSha256, generateArthash } from './image'

interface ParsedMetadata {
  arthash?: unknown
  perceptualHash?: unknown
  sha256?: unknown
  [key: string]: unknown
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
      logger.warn(`Skip ${url}: HTTP ${response.status}`)
      return null
    }
    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }
  catch (error) {
    logger.warn(`Skip ${url}: ${String(error)}`)
    return null
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export interface ArthashBackfillSummary {
  total: number
  updated: number
  skipped: number
}

export async function backfillArthash(): Promise<ArthashBackfillSummary> {
  const rows = await db.query.files.findMany({
    orderBy: [asc(files.id)],
  })

  let updated = 0
  let skipped = 0

  for (const file of rows) {
    const metadata = parseMetadata(file.metadata)
    const hasArthash = isNonEmptyString(metadata.arthash)
    const hasPerceptualHash = isNonEmptyString(metadata.perceptualHash)
    const hasSha256 = isNonEmptyString(metadata.sha256)

    if (hasArthash && hasPerceptualHash && hasSha256) {
      continue
    }

    const sourceUrl = file.imageUrl?.trim() ?? ''
    if (!sourceUrl) {
      logger.warn(`File #${file.id} has no usable image URL`)
      skipped += 1
      continue
    }

    const imageBuffer = await fetchImage(sourceUrl)
    if (!imageBuffer) {
      skipped += 1
      continue
    }

    const arthash = hasArthash ? String(metadata.arthash) : await generateArthash(imageBuffer)
    const perceptualHash = hasPerceptualHash ? String(metadata.perceptualHash) : await computePerceptualHash(imageBuffer)
    const sha256 = hasSha256 ? String(metadata.sha256) : computeSha256(imageBuffer)

    let changed = false
    if (!hasArthash && arthash) {
      metadata.arthash = arthash
      changed = true
    }
    if (!hasPerceptualHash && perceptualHash) {
      metadata.perceptualHash = perceptualHash
      changed = true
    }
    if (!hasSha256 && sha256) {
      metadata.sha256 = sha256
      changed = true
    }

    if (!changed) {
      continue
    }

    await db
      .update(files)
      .set({ metadata: JSON.stringify(metadata) })
      .where(eq(files.id, file.id))

    logger.info(`Updated #${file.id} (${file.title || 'untitled'})`)
    updated += 1
  }

  logger.info(`Backfill arthash complete. Added arthash for ${updated} of ${rows.length} records.`)
  return { total: rows.length, updated, skipped }
}
