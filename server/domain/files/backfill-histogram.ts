import type { HistogramData } from '../../../app/types/file'
import { eq } from 'drizzle-orm'
import { db, files } from '../../utils/db'
import { computeHistogram } from '../../utils/histogram'
import { logger } from '../../utils/logger'

interface ParsedMetadata {
  histogram?: HistogramData | null
  [key: string]: unknown
}

function parseMetadata(raw: string): ParsedMetadata | null {
  try {
    const value = JSON.parse(raw)
    if (value && typeof value === 'object') {
      return value as ParsedMetadata
    }
    return {}
  }
  catch (error) {
    logger.warn('Failed to parse metadata, skipping entry:', { error })
    return null
  }
}

async function fetchImageBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`)
  }
  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

export interface HistogramBackfillSummary {
  total: number
  updated: number
  skipped: number
}

export async function backfillHistogram(): Promise<HistogramBackfillSummary> {
  const rows = await db
    .select({ id: files.id, imageUrl: files.imageUrl, metadata: files.metadata })
    .from(files)

  let updated = 0
  let skipped = 0

  for (const file of rows) {
    const metadata = parseMetadata(file.metadata)
    if (!metadata) {
      skipped += 1
      continue
    }
    if (metadata.histogram) {
      skipped += 1
      continue
    }

    try {
      const buffer = await fetchImageBuffer(file.imageUrl)
      const histogram = await computeHistogram(buffer)
      if (!histogram) {
        logger.warn(`Histogram generation failed for file #${file.id}`)
        skipped += 1
        continue
      }

      metadata.histogram = histogram
      await db
        .update(files)
        .set({ metadata: JSON.stringify(metadata) })
        .where(eq(files.id, file.id))
      updated += 1

      logger.info(`Updated histogram for file #${file.id}`)
    }
    catch (error) {
      logger.warn(`Failed to update histogram for file #${file.id}:`, { error })
      skipped += 1
    }
  }

  logger.info(`Backfill histogram done. Updated ${updated}, skipped ${skipped}.`)
  return { total: rows.length, updated, skipped }
}
