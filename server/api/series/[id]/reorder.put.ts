import type { SeriesReorderPayload } from '~/types/series'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { createError, getRouterParam, readBody } from 'h3'
import { parseNumericId, parseSeriesReorderItems } from '../../../domain/series/service'
import { requireAdmin } from '../../../utils/auth'
import { db, series, seriesFiles } from '../../../utils/db'
import { ensureSeriesSchema } from '../../../utils/series-schema'

function parseSeriesId(raw: string | undefined): number {
  const parsed = parseNumericId(raw)
  if (!parsed) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid series id.' })
  }
  return parsed
}

export default defineEventHandler(async (event): Promise<{ success: true }> => {
  await ensureSeriesSchema()
  requireAdmin(event)
  const seriesId = parseSeriesId(getRouterParam(event, 'id'))
  const body = await readBody<SeriesReorderPayload>(event)
  const items = parseSeriesReorderItems(body?.items)

  if (items.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'items is required.' })
  }

  const seriesRow = await db.query.series.findFirst({
    where: eq(series.id, seriesId),
  })
  if (!seriesRow) {
    throw createError({ statusCode: 404, statusMessage: 'Series not found.' })
  }

  const fileIds = [...new Set(items.map(item => item.fileId))]
  const existingRows = await db
    .select({ fileId: seriesFiles.fileId })
    .from(seriesFiles)
    .where(and(eq(seriesFiles.seriesId, seriesId), inArray(seriesFiles.fileId, fileIds)))

  if (existingRows.length !== fileIds.length) {
    throw createError({ statusCode: 400, statusMessage: 'Some files are not in this series.' })
  }

  await db.transaction(async (tx) => {
    for (const item of items) {
      await tx
        .update(seriesFiles)
        .set({ sortOrder: item.sortOrder })
        .where(and(eq(seriesFiles.seriesId, seriesId), eq(seriesFiles.fileId, item.fileId)))
    }

    await tx
      .update(series)
      .set({ updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(series.id, seriesId))
  })

  return { success: true }
})
