import type { FileSeriesUpdatePayload } from '~/types/series'
import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import { createError, getRouterParam, readBody } from 'h3'
import { requireAdmin } from '../../../utils/auth'
import { db, files, series, seriesFiles } from '../../../utils/db'
import { ensureSeriesSchema } from '../../../utils/series-schema'

function parseFileId(raw: string | undefined): number {
  const parsed = Number.parseInt(raw ?? '', 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid file id.' })
  }
  return parsed
}

function parseSeriesIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) {
    throw createError({ statusCode: 400, statusMessage: 'seriesIds must be an array.' })
  }
  const ids = raw
    .map((value) => {
      if (typeof value === 'number') {
        return Number.isInteger(value) && value > 0 ? value : null
      }
      if (typeof value === 'string') {
        const parsed = Number.parseInt(value, 10)
        return Number.isFinite(parsed) && parsed > 0 ? parsed : null
      }
      return null
    })
    .filter((value): value is number => value !== null)

  const unique = [...new Set(ids)]
  if (unique.length !== raw.length) {
    throw createError({ statusCode: 400, statusMessage: 'seriesIds must contain unique positive ids.' })
  }
  return unique
}

export default defineEventHandler(async (event): Promise<{ seriesIds: number[] }> => {
  await ensureSeriesSchema()
  requireAdmin(event)

  const fileId = parseFileId(getRouterParam(event, 'id'))
  const body = await readBody<FileSeriesUpdatePayload>(event)
  const targetSeriesIds = parseSeriesIds(body?.seriesIds)

  const fileRow = await db.query.files.findFirst({
    where: eq(files.id, fileId),
  })
  if (!fileRow) {
    throw createError({ statusCode: 404, statusMessage: 'File not found.' })
  }

  if (targetSeriesIds.length > 0) {
    const seriesRows = await db
      .select({ id: series.id })
      .from(series)
      .where(inArray(series.id, targetSeriesIds))
    if (seriesRows.length !== targetSeriesIds.length) {
      throw createError({ statusCode: 400, statusMessage: 'Some seriesIds do not exist.' })
    }
  }

  await db.transaction(async (tx) => {
    const currentRows = await tx
      .select({ seriesId: seriesFiles.seriesId })
      .from(seriesFiles)
      .where(eq(seriesFiles.fileId, fileId))

    const currentIds = currentRows.map(row => row.seriesId)
    const currentSet = new Set(currentIds)
    const targetSet = new Set(targetSeriesIds)

    const toRemove = currentIds.filter(seriesId => !targetSet.has(seriesId))
    const toAdd = targetSeriesIds.filter(seriesId => !currentSet.has(seriesId))

    if (toRemove.length > 0) {
      await tx
        .delete(seriesFiles)
        .where(and(eq(seriesFiles.fileId, fileId), inArray(seriesFiles.seriesId, toRemove)))

      await tx
        .update(series)
        .set({
          coverFileId: null,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(and(inArray(series.id, toRemove), eq(series.coverFileId, fileId)))
    }

    if (toAdd.length > 0) {
      const maxSortRows = await tx
        .select({
          seriesId: seriesFiles.seriesId,
          maxSort: sql<number>`max(${seriesFiles.sortOrder})`,
        })
        .from(seriesFiles)
        .where(inArray(seriesFiles.seriesId, toAdd))
        .groupBy(seriesFiles.seriesId)

      const maxSortMap = new Map<number, number>()
      for (const row of maxSortRows) {
        maxSortMap.set(row.seriesId, Number.isInteger(row.maxSort) ? row.maxSort : 0)
      }

      await tx.insert(seriesFiles).values(
        toAdd.map((seriesId) => {
          const maxSort = maxSortMap.get(seriesId) ?? 0
          maxSortMap.set(seriesId, maxSort + 1)
          return {
            seriesId,
            fileId,
            sortOrder: maxSort + 1,
          }
        }),
      )

      await tx
        .update(series)
        .set({
          coverFileId: fileId,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(and(inArray(series.id, toAdd), isNull(series.coverFileId)))
    }

    const touchedSeriesIds = [...new Set([...toAdd, ...toRemove])]
    if (touchedSeriesIds.length > 0) {
      await tx
        .update(series)
        .set({ updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(inArray(series.id, touchedSeriesIds))
    }
  })

  return { seriesIds: targetSeriesIds }
})
