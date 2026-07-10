import type { H3Event } from 'h3'
import type { FileSummary } from '~/types/file'
import type { SeriesDetail } from '~/types/series'
import { asc, desc, eq, notExists, sql } from 'drizzle-orm'
import { createError, getQuery, getRouterParam } from 'h3'
import { toWaterfallSummary, waterfallSummarySelection } from '../../../domain/files/listing'
import { parseSeriesPagination, toIsoString } from '../../../domain/series/service'
import { db, files, series, seriesFiles } from '../../../utils/db'
import { handleJsonEtag } from '../../../utils/http-cache'
import { ensureSeriesSchema } from '../../../utils/series-schema'

const UNCATEGORIZED_SERIES_ID = 0
const UNCATEGORIZED_SERIES_SLUG = '__uncategorized__'

function parseSlugFromPath(path: string): string | null {
  const match = path.match(/^\/api\/series\/by-slug\/([^/?#]+)(?:[/?#]|$)/)
  if (!match?.[1]) {
    return null
  }
  try {
    return decodeURIComponent(match[1]).trim()
  }
  catch {
    return match[1].trim()
  }
}

function parseSlug(event: H3Event): string {
  const fromParam = getRouterParam(event, 'slug')
  if (typeof fromParam === 'string' && fromParam.trim().length > 0) {
    return fromParam.trim()
  }
  const fromUnderscoreParam = getRouterParam(event, '_slug_')
  if (typeof fromUnderscoreParam === 'string' && fromUnderscoreParam.trim().length > 0) {
    return fromUnderscoreParam.trim()
  }
  const fromPath = parseSlugFromPath(event.path || event.node.req.url || '')
  if (fromPath && fromPath.length > 0) {
    return fromPath
  }
  throw createError({ statusCode: 400, statusMessage: 'Invalid series slug.' })
}

function applyPagination<T>(query: T, limit: number | null, offset: number | null): T {
  if (typeof limit === 'number' && typeof offset === 'number') {
    return (query as { limit: (value: number) => { offset: (offsetValue: number) => T } })
      .limit(limit)
      .offset(offset)
  }
  if (typeof limit === 'number') {
    return (query as { limit: (value: number) => T }).limit(limit)
  }
  if (typeof offset === 'number') {
    return (query as { offset: (value: number) => T }).offset(offset)
  }
  return query
}

async function resolveSeriesCover(seriesId: number, coverFileId: number | null): Promise<FileSummary | null> {
  if (coverFileId) {
    const coverRows = await db
      .select(waterfallSummarySelection())
      .from(files)
      .where(eq(files.id, coverFileId))
      .limit(1)
    if (coverRows[0]) {
      return toWaterfallSummary(coverRows[0])
    }
  }

  const firstFile = await db
    .select(waterfallSummarySelection())
    .from(seriesFiles)
    .innerJoin(files, eq(files.id, seriesFiles.fileId))
    .where(eq(seriesFiles.seriesId, seriesId))
    .orderBy(asc(seriesFiles.sortOrder), desc(files.captureTime), desc(files.createdAt), desc(files.id))
    .limit(1)

  if (!firstFile[0]) {
    return null
  }
  return toWaterfallSummary(firstFile[0])
}

export default defineEventHandler(async (event): Promise<SeriesDetail | null> => {
  await ensureSeriesSchema()
  const slug = parseSlug(event)
  const query = getQuery(event)
  const { limit, offset } = parseSeriesPagination(query as Record<string, unknown>)

  if (slug === UNCATEGORIZED_SERIES_SLUG) {
    const [
      countRow,
      coverRows,
      filesRows,
    ] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(files)
        .where(
          notExists(
            db
              .select({ id: seriesFiles.fileId })
              .from(seriesFiles)
              .where(eq(seriesFiles.fileId, files.id)),
          ),
        ),
      db
        .select(waterfallSummarySelection())
        .from(files)
        .where(
          notExists(
            db
              .select({ id: seriesFiles.fileId })
              .from(seriesFiles)
              .where(eq(seriesFiles.fileId, files.id)),
          ),
        )
        .orderBy(desc(files.captureTime), desc(files.createdAt), desc(files.id))
        .limit(1),
      applyPagination(
        db
          .select(waterfallSummarySelection())
          .from(files)
          .where(
            notExists(
              db
                .select({ id: seriesFiles.fileId })
                .from(seriesFiles)
                .where(eq(seriesFiles.fileId, files.id)),
            ),
          )
          .orderBy(desc(files.captureTime), desc(files.createdAt), desc(files.id)),
        limit,
        offset,
      ),
    ])

    const nowIso = new Date().toISOString()
    const detail: SeriesDetail = {
      id: UNCATEGORIZED_SERIES_ID,
      slug: UNCATEGORIZED_SERIES_SLUG,
      title: 'Uncategorized',
      description: '',
      coverFileId: null,
      cover: coverRows[0] ? toWaterfallSummary(coverRows[0]) : null,
      fileCount: countRow[0]?.count ?? 0,
      isVirtual: true,
      createdAt: nowIso,
      updatedAt: nowIso,
      files: filesRows.map(row => toWaterfallSummary(row)),
    }
    if (handleJsonEtag(event, { ...detail, createdAt: '', updatedAt: '' })) {
      return null
    }
    return detail
  }

  const seriesRow = await db.query.series.findFirst({
    where: eq(series.slug, slug),
  })

  if (!seriesRow) {
    throw createError({ statusCode: 404, statusMessage: 'Series not found.' })
  }

  const [
    countRow,
    cover,
    filesRows,
  ] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(seriesFiles)
      .where(eq(seriesFiles.seriesId, seriesRow.id)),
    resolveSeriesCover(seriesRow.id, seriesRow.coverFileId),
    applyPagination(
      db
        .select(waterfallSummarySelection())
        .from(seriesFiles)
        .innerJoin(files, eq(files.id, seriesFiles.fileId))
        .where(eq(seriesFiles.seriesId, seriesRow.id))
        .orderBy(
          asc(seriesFiles.sortOrder),
          desc(files.captureTime),
          desc(files.createdAt),
          desc(files.id),
        ),
      limit,
      offset,
    ),
  ])

  const mappedFiles = filesRows.map(row => toWaterfallSummary(row))
  const detail: SeriesDetail = {
    id: seriesRow.id,
    slug: seriesRow.slug,
    title: seriesRow.title,
    description: seriesRow.description,
    coverFileId: seriesRow.coverFileId,
    cover,
    fileCount: countRow[0]?.count ?? 0,
    isVirtual: false,
    createdAt: toIsoString(seriesRow.createdAt),
    updatedAt: toIsoString(seriesRow.updatedAt),
    files: mappedFiles,
  }
  if (handleJsonEtag(event, detail)) {
    return null
  }
  return detail
})
