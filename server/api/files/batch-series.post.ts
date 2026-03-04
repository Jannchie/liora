import type { BatchActionResult, BatchSeriesPayload } from '~/types/file'
import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import { createError, readBody } from 'h3'
import { parseBatchSeriesPayload } from '../../domain/files/batch'
import { requireAdmin } from '../../utils/auth'
import { db, files, series, seriesFiles } from '../../utils/db'
import { ensureSeriesSchema } from '../../utils/series-schema'

export default defineEventHandler(async (event): Promise<BatchActionResult> => {
  await ensureSeriesSchema()
  requireAdmin(event)
  const body = await readBody<BatchSeriesPayload>(event)
  const { fileIds, seriesId } = parseBatchSeriesPayload(body)

  const seriesRow = await db.query.series.findFirst({
    where: eq(series.id, seriesId),
  })
  if (!seriesRow) {
    throw createError({ statusCode: 404, statusMessage: 'Series not found.' })
  }

  const fileRows = await db
    .select({ id: files.id })
    .from(files)
    .where(inArray(files.id, fileIds))
  const existingSet = new Set(fileRows.map(row => row.id))

  const validFileIds = fileIds.filter(fileId => existingSet.has(fileId))
  const failures: BatchActionResult['failures'] = fileIds
    .filter(fileId => !existingSet.has(fileId))
    .map(fileId => ({ id: fileId, message: 'File not found.' }))

  if (validFileIds.length > 0) {
    const [existingRows, maxSortRow] = await Promise.all([
      db
        .select({ fileId: seriesFiles.fileId })
        .from(seriesFiles)
        .where(and(eq(seriesFiles.seriesId, seriesId), inArray(seriesFiles.fileId, validFileIds))),
      db
        .select({ maxSort: sql<number>`max(${seriesFiles.sortOrder})` })
        .from(seriesFiles)
        .where(eq(seriesFiles.seriesId, seriesId)),
    ])

    const existingLinkedSet = new Set(existingRows.map(row => row.fileId))
    const toAdd = validFileIds.filter(fileId => !existingLinkedSet.has(fileId))

    if (toAdd.length > 0) {
      const maxSort = maxSortRow[0]?.maxSort
      const baseSort = typeof maxSort === 'number' && Number.isInteger(maxSort) ? maxSort : 0

      await db.insert(seriesFiles).values(
        toAdd.map((fileId, index) => ({
          seriesId,
          fileId,
          sortOrder: baseSort + index + 1,
        })),
      )
    }

    await (seriesRow.coverFileId
      ? db
          .update(series)
          .set({ updatedAt: sql`CURRENT_TIMESTAMP` })
          .where(eq(series.id, seriesId))
      : db
          .update(series)
          .set({
            coverFileId: validFileIds[0] ?? null,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          })
          .where(and(eq(series.id, seriesId), isNull(series.coverFileId))))
  }

  return {
    total: fileIds.length,
    success: validFileIds.length,
    failed: failures.length,
    failures,
  }
})
