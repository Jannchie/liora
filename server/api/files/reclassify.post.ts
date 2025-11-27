import type { GenreClassificationResult } from '../../utils/ai-classifier'
import { classifyPhotoGenre, deriveGenreLabel } from '../../utils/ai-classifier'
import { requireAdmin } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

interface ReclassifySummary {
  total: number
  updated: number
  skipped: number
  failed: number
}

export default defineEventHandler(async (event): Promise<ReclassifySummary> => {
  requireAdmin(event)

  const targets = await prisma.file.findMany({
    where: {
      genre: '',
    },
    select: { id: true, imageUrl: true },
    orderBy: { id: 'asc' },
  })

  let updated = 0
  let skipped = 0
  let failed = 0
  let processed = 0

  for (const file of targets) {
    processed += 1
    // eslint-disable-next-line no-console
    console.info(`[reclassify] processing #${file.id} (${processed}/${targets.length})`)
    try {
      const result: GenreClassificationResult | null = await classifyPhotoGenre(event, file.imageUrl)
      const genre = deriveGenreLabel(result)
      if (!genre) {
        skipped += 1
        continue
      }
      await prisma.file.update({
        where: { id: file.id },
        data: { genre },
      })
      // eslint-disable-next-line no-console
      console.info(`[reclassify] updated #${file.id} -> ${genre}`)
      updated += 1
    }
    catch (error) {
      failed += 1
      console.warn(`[reclassify] failed for #${file.id}:`, error)
    }
  }

  return {
    total: targets.length,
    updated,
    skipped,
    failed,
  }
})
