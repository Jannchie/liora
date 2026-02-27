import { and, eq, sql } from 'drizzle-orm'
import { createError, getRouterParam } from 'h3'
import { parseNumericId } from '../../../../domain/series/service'
import { requireAdmin } from '../../../../utils/auth'
import { db, series, seriesFiles } from '../../../../utils/db'
import { ensureSeriesSchema } from '../../../../utils/series-schema'

function parseRequiredId(value: string | undefined, field: string): number {
  const parsed = parseNumericId(value)
  if (!parsed) {
    throw createError({ statusCode: 400, statusMessage: `Invalid ${field}.` })
  }
  return parsed
}

export default defineEventHandler(async (event): Promise<{ success: true }> => {
  await ensureSeriesSchema()
  requireAdmin(event)
  const seriesId = parseRequiredId(getRouterParam(event, 'id'), 'series id')
  const fileId = parseRequiredId(getRouterParam(event, 'fileId'), 'file id')

  const seriesRow = await db.query.series.findFirst({
    where: eq(series.id, seriesId),
  })
  if (!seriesRow) {
    throw createError({ statusCode: 404, statusMessage: 'Series not found.' })
  }

  const deleted = await db
    .delete(seriesFiles)
    .where(and(eq(seriesFiles.seriesId, seriesId), eq(seriesFiles.fileId, fileId)))
    .returning({ fileId: seriesFiles.fileId })

  if (deleted.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Series file relation not found.' })
  }

  await db
    .update(series)
    .set({
      coverFileId: seriesRow.coverFileId === fileId ? null : seriesRow.coverFileId,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .where(eq(series.id, seriesId))

  return { success: true }
})
