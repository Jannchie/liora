import type { SeriesSummary, SeriesUpsertPayload } from '~/types/series'
import { and, eq, ne, sql } from 'drizzle-orm'
import { createError, getRouterParam, readBody } from 'h3'
import {
  normalizeSeriesDescription,
  normalizeSeriesSlug,
  normalizeSeriesText,
  parseNumericId,
  slugifySeriesTitle,
  toIsoString,
} from '../../domain/series/service'
import { requireAdmin } from '../../utils/auth'
import { db, files, series, seriesFiles } from '../../utils/db'
import { ensureSeriesSchema } from '../../utils/series-schema'

function parseSeriesId(raw: string | undefined): number {
  const parsed = parseNumericId(raw)
  if (!parsed) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid series id.' })
  }
  return parsed
}

function parseOptionalCoverFileId(value: unknown): number | null | undefined {
  if (value === undefined) {
    return undefined
  }
  if (value === null || value === '') {
    return null
  }
  const parsed = parseNumericId(value)
  if (!parsed) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid coverFileId.' })
  }
  return parsed
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

async function validateCoverFile(seriesId: number, coverFileId: number | null): Promise<number | null> {
  if (coverFileId === null) {
    return null
  }

  const [fileRow, relationRow] = await Promise.all([
    db.query.files.findFirst({
      where: eq(files.id, coverFileId),
    }),
    db.query.seriesFiles.findFirst({
      where: and(eq(seriesFiles.seriesId, seriesId), eq(seriesFiles.fileId, coverFileId)),
    }),
  ])

  if (!fileRow) {
    throw createError({ statusCode: 400, statusMessage: 'Cover file does not exist.' })
  }
  if (!relationRow) {
    throw createError({ statusCode: 400, statusMessage: 'Cover file must belong to the current series.' })
  }
  return coverFileId
}

export default defineEventHandler(async (event): Promise<SeriesSummary> => {
  await ensureSeriesSchema()
  requireAdmin(event)
  const id = parseSeriesId(getRouterParam(event, 'id'))
  const body = await readBody<Partial<SeriesUpsertPayload>>(event)

  const existing = await db.query.series.findFirst({
    where: eq(series.id, id),
  })
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Series not found.' })
  }

  const title = normalizeSeriesText(body.title ?? existing.title)
  if (!title) {
    throw createError({ statusCode: 400, statusMessage: 'Title is required.' })
  }
  const description = normalizeSeriesDescription(body.description ?? existing.description)

  const nextSlugInput = body.slug === undefined
    ? existing.slug
    : normalizeSeriesSlug(body.slug)
  const nextSlugBase = nextSlugInput || slugifySeriesTitle(title) || existing.slug || 'series'
  const slug = await resolveUniqueSlug(nextSlugBase, id)

  const parsedCover = parseOptionalCoverFileId(body.coverFileId)
  const coverFileId = await validateCoverFile(id, parsedCover === undefined ? existing.coverFileId : parsedCover)

  const [updated] = await db
    .update(series)
    .set({
      title,
      slug,
      description,
      coverFileId,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .where(eq(series.id, id))
    .returning()

  if (!updated) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to update series.' })
  }

  const countRow = await db
    .select({ count: sql<number>`count(*)` })
    .from(seriesFiles)
    .where(eq(seriesFiles.seriesId, id))

  return {
    id: updated.id,
    slug: updated.slug,
    title: updated.title,
    description: updated.description,
    coverFileId: updated.coverFileId,
    cover: null,
    fileCount: countRow[0]?.count ?? 0,
    createdAt: toIsoString(updated.createdAt),
    updatedAt: toIsoString(updated.updatedAt),
  }
})
