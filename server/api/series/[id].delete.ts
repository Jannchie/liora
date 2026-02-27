import { eq } from 'drizzle-orm'
import { createError, getRouterParam } from 'h3'
import { parseNumericId } from '../../domain/series/service'
import { requireAdmin } from '../../utils/auth'
import { db, series } from '../../utils/db'
import { ensureSeriesSchema } from '../../utils/series-schema'

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
  const id = parseSeriesId(getRouterParam(event, 'id'))

  const existing = await db.query.series.findFirst({
    where: eq(series.id, id),
  })
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Series not found.' })
  }

  await db.delete(series).where(eq(series.id, id))
  return { success: true }
})
