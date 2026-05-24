import type { SeriesFileAssignPayload } from '~/types/series'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { createError, getRouterParam, readBody } from 'h3'
import { parseNumericId, parseUniqueFileIds } from '../../../../domain/series/service'
import { requireAdmin } from '../../../../utils/auth'
import { db, files, series, seriesFiles } from '../../../../utils/db'
import { ensureSeriesSchema } from '../../../../utils/series-schema'

function parseSeriesId(raw: string | undefined): number {
  const parsed = parseNumericId(raw)
  if (!parsed) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid series id.' })
  }
  return parsed
}

export default defineEventHandler(async (event): Promise<{ added: number }> => {
  await ensureSeriesSchema()
  requireAdmin(event)
  const seriesId = parseSeriesId(getRouterParam(event, 'id'))
  const body = await readBody<SeriesFileAssignPayload>(event)
  const fileIds = parseUniqueFileIds(body?.fileIds)

  if (fileIds.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'fileIds is required.' })
  }

  const seriesRow = await db.query.series.findFirst({
    where: eq(series.id, seriesId),
  })
  if (!seriesRow) {
    throw createError({ statusCode: 404, statusMessage: 'Series not found.' })
  }

  const [
    fileRows,
    existingRows,
    maxSortRow,
  ] = await Promise.all([
    db
      .select({ id: files.id })
      .from(files)
      .where(inArray(files.id, fileIds)),
    db
      .select({ fileId: seriesFiles.fileId })
      .from(seriesFiles)
      .where(and(eq(seriesFiles.seriesId, seriesId), inArray(seriesFiles.fileId, fileIds))),
    db
      .select({ maxSort: sql<number>`max(${seriesFiles.sortOrder})` })
      .from(seriesFiles)
      .where(eq(seriesFiles.seriesId, seriesId)),
  ])

  if (fileRows.length !== fileIds.length) {
    throw createError({ statusCode: 400, statusMessage: 'Some fileIds do not exist.' })
  }

  const existingSet = new Set(existingRows.map(row => row.fileId))
  const missingIds = fileIds.filter(fileId => !existingSet.has(fileId))

  if (missingIds.length === 0) {
    return { added: 0 }
  }

  const maxSort = maxSortRow[0]?.maxSort
  const baseSort = typeof maxSort === 'number' && Number.isInteger(maxSort) ? maxSort : 0

  await db.transaction(async (tx) => {
    await tx.insert(seriesFiles).values(
      missingIds.map((fileId, index) => ({
        seriesId,
        fileId,
        sortOrder: baseSort + index + 1,
      })),
    )

    await (seriesRow.coverFileId
      ? tx
          .update(series)
          .set({ updatedAt: sql`CURRENT_TIMESTAMP` })
          .where(eq(series.id, seriesId))
      : tx
          .update(series)
          .set({
            coverFileId: missingIds[0] ?? null,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          })
          .where(eq(series.id, seriesId)))
  })

  return { added: missingIds.length }
})
