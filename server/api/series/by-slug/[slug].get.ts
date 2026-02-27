import type { H3Event } from 'h3'
import type { FileSummary } from '~/types/file'
import type { SeriesDetail } from '~/types/series'
import { asc, desc, eq, notExists, sql } from 'drizzle-orm'
import { createError, getQuery, getRouterParam } from 'h3'
import { toWaterfallSummary } from '../../../domain/files/listing'
import { parseSeriesPagination } from '../../../domain/series/service'
import { db, files, series, seriesFiles } from '../../../utils/db'
import { ensureSeriesSchema } from '../../../utils/series-schema'

interface FileListRow {
  id: number
  imageUrl: string
  width: number
  height: number
  metadata: string
}

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

function toIsoString(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString()
  }
  return parsed.toISOString()
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
    const coverFile = await db.query.files.findFirst({
      where: eq(files.id, coverFileId),
    })
    if (coverFile) {
      return toWaterfallSummary({
        id: coverFile.id,
        imageUrl: coverFile.imageUrl,
        width: coverFile.width,
        height: coverFile.height,
        metadata: coverFile.metadata,
      })
    }
  }

  const firstFile = await db
    .select({
      id: files.id,
      imageUrl: files.imageUrl,
      width: files.width,
      height: files.height,
      metadata: files.metadata,
    })
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

export default defineEventHandler(async (event): Promise<SeriesDetail> => {
  await ensureSeriesSchema()
  setHeader(event, 'Cache-Control', 'no-store')
  setHeader(event, 'Pragma', 'no-cache')
  setHeader(event, 'Expires', '0')

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
        .select({
          id: files.id,
          imageUrl: files.imageUrl,
          width: files.width,
          height: files.height,
          metadata: files.metadata,
        })
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
          .select({
            id: files.id,
            imageUrl: files.imageUrl,
            width: files.width,
            height: files.height,
            metadata: files.metadata,
          })
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
    return {
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
      files: filesRows.map((row: FileListRow) => toWaterfallSummary(row)),
    }
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
        .select({
          id: files.id,
          imageUrl: files.imageUrl,
          width: files.width,
          height: files.height,
          metadata: files.metadata,
        })
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

  const mappedFiles = filesRows.map((row: FileListRow) => toWaterfallSummary(row))
  return {
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
})
