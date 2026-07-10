import type { SeriesSummary, SeriesUpsertPayload } from '~/types/series'
import { and, eq, ne } from 'drizzle-orm'
import { createError, readBody } from 'h3'
import { normalizeSeriesDescription, normalizeSeriesSlug, normalizeSeriesText, slugifySeriesTitle, toIsoString } from '../domain/series/service'
import { requireAdmin } from '../utils/auth'
import { db, files, series } from '../utils/db'
import { ensureSeriesSchema } from '../utils/series-schema'

function parseOptionalCoverFileId(value: unknown): number | null | undefined {
  if (value === undefined) {
    return undefined
  }
  if (value === null || value === '') {
    return null
  }
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid coverFileId.' })
  }
  return parsed
}

async function ensureCoverExists(coverFileId: number | null): Promise<number | null> {
  if (!coverFileId) {
    return null
  }
  const row = await db.query.files.findFirst({
    where: eq(files.id, coverFileId),
  })
  if (!row) {
    throw createError({ statusCode: 400, statusMessage: 'Cover file does not exist.' })
  }
  return coverFileId
}

async function resolveUniqueSlug(baseSlug: string, excludeId?: number): Promise<string> {
  const normalizedBase = baseSlug.trim() || 'series'
  let candidate = normalizedBase
  let index = 2
  for (;;) {
    const existing = await db.query.series.findFirst({
      where: excludeId
        ? and(eq(series.slug, candidate), ne(series.id, excludeId))
        : eq(series.slug, candidate),
    })
    if (!existing) {
      return candidate
    }
    candidate = `${normalizedBase}-${index}`
    index += 1
  }
}

export default defineEventHandler(async (event): Promise<SeriesSummary> => {
  await ensureSeriesSchema()
  requireAdmin(event)
  const body = await readBody<SeriesUpsertPayload>(event)

  const title = normalizeSeriesText(body?.title)
  if (!title) {
    throw createError({ statusCode: 400, statusMessage: 'Title is required.' })
  }

  const description = normalizeSeriesDescription(body?.description)
  const coverFileId = await ensureCoverExists(parseOptionalCoverFileId(body?.coverFileId) ?? null)
  const requestedSlug = normalizeSeriesSlug(body?.slug)
  const fallbackSlug = slugifySeriesTitle(title)
  const uniqueSlug = await resolveUniqueSlug(requestedSlug || fallbackSlug || 'series')

  const [created] = await db
    .insert(series)
    .values({
      slug: uniqueSlug,
      title,
      description,
      coverFileId,
    })
    .returning()

  if (!created) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to create series.' })
  }

  return {
    id: created.id,
    slug: created.slug,
    title: created.title,
    description: created.description,
    coverFileId: created.coverFileId,
    cover: null,
    fileCount: 0,
    createdAt: toIsoString(created.createdAt),
    updatedAt: toIsoString(created.updatedAt),
  }
})
