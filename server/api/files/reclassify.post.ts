import type { GenreClassificationResult } from '../../utils/ai-classifier'
import { eq } from 'drizzle-orm'
import { classifyPhotoGenre, deriveGenreLabel } from '../../utils/ai-classifier'
import { requireAdmin } from '../../utils/auth'
import { db, files } from '../../utils/db'
import { logger } from '../../utils/logger'

interface ReclassifySummary {
  total: number
  updated: number
  skipped: number
  failed: number
}

export default defineEventHandler(async (event): Promise<ReclassifySummary> => {
  requireAdmin(event)

  const targets = await db
    .select({ id: files.id, imageUrl: files.imageUrl })
    .from(files)
    .where(eq(files.genre, ''))
    .orderBy(files.id)

  let updated = 0
  let skipped = 0
  let failed = 0
  let processed = 0

  for (const file of targets) {
    processed += 1
    logger.info('reclassify processing', { fileId: file.id, processed, total: targets.length })
    try {
      const result: GenreClassificationResult | null = await classifyPhotoGenre(event, file.imageUrl)
      const genre = deriveGenreLabel(result)
      if (!genre) {
        skipped += 1
        continue
      }
      await db.update(files).set({ genre }).where(eq(files.id, file.id))
      logger.info('reclassify updated', { fileId: file.id, genre })
      updated += 1
    }
    catch (error) {
      failed += 1
      logger.warn('reclassify failed', { fileId: file.id, error })
    }
  }

  return {
    total: targets.length,
    updated,
    skipped,
    failed,
  }
})
