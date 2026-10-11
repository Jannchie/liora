import type { BackfillSummary } from './backfill-io'
import { eq } from 'drizzle-orm'
import { db, files } from '../../utils/db'
import { extractFocusMetadataFromBuffer } from '../../utils/focus-metadata'
import { logger } from '../../utils/logger'
import { fetchImageBuffer, parseMetadataObject } from './backfill-io'
import { clampExtractedMetadata } from './metadata'

/**
 * Re-reads the editing recipe (LLR's `llr:Settings`, Lightroom's `crs:*`)
 * from every stored original, so files uploaded before a recipe was read — or
 * read by an older, narrower extractor — get the current view. The browser-side
 * EXIF backfill cannot do this: recipes live in XMP, which only exiftool reads.
 * A file whose read fails keeps what it has; one that reads cleanly gets
 * exactly what its pixels carry, including no recipe at all.
 */
export async function backfillRecipes(): Promise<BackfillSummary> {
  const rows = await db
    .select({ id: files.id, imageUrl: files.imageUrl, metadata: files.metadata, originalName: files.originalName })
    .from(files)

  let updated = 0
  let skipped = 0

  for (const file of rows) {
    const metadata = parseMetadataObject(file.metadata)
    if (!metadata || !file.imageUrl?.trim()) {
      skipped += 1
      continue
    }

    try {
      const buffer = await fetchImageBuffer(file.imageUrl)
      const extracted = clampExtractedMetadata(await extractFocusMetadataFromBuffer(buffer, file.originalName || undefined))
      if (!extracted) {
        skipped += 1
        continue
      }
      if (metadata.llrRecipe === extracted.llrRecipe && metadata.lightroomRecipe === extracted.lightroomRecipe) {
        skipped += 1
        continue
      }
      const next = { ...metadata, llrRecipe: extracted.llrRecipe, lightroomRecipe: extracted.lightroomRecipe }
      await db
        .update(files)
        .set({ metadata: JSON.stringify(next) })
        .where(eq(files.id, file.id))
      updated += 1
      logger.info(`Updated recipe for file #${file.id}`)
    }
    catch (error) {
      logger.warn(`Failed to update recipe for file #${file.id}:`, { error })
      skipped += 1
    }
  }

  logger.info(`Backfill recipe done. Updated ${updated}, skipped ${skipped}.`)
  return { total: rows.length, updated, skipped }
}
