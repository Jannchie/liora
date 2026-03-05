import type { FileSummary } from '~/types/file'
import type { SeriesSummary } from '~/types/series'
import { asc, desc, eq, inArray, notExists, sql } from 'drizzle-orm'
import { toWaterfallSummary } from '../domain/files/listing'
import { db, files, series, seriesFiles } from '../utils/db'
import { ensureSeriesSchema } from '../utils/series-schema'

interface SeriesBaseRow {
  id: number
  slug: string
  title: string
  description: string
  coverFileId: number | null
  createdAt: string
  updatedAt: string
}

interface SeriesCountRow {
  seriesId: number
  count: number
}

interface CoverCandidateRow {
  id: number
  imageUrl: string
  width: number
  height: number
  metadata: string
}

interface PreviewCandidateRow extends CoverCandidateRow {
  seriesId: number
}

const UNCATEGORIZED_SERIES_ID = 0
const UNCATEGORIZED_SERIES_SLUG = '__uncategorized__'
const SERIES_PREVIEW_LIMIT = 8

function toIsoString(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString()
  }
  return parsed.toISOString()
}

function mapCounts(rows: SeriesCountRow[]): Map<number, number> {
  const countMap = new Map<number, number>()
  for (const row of rows) {
    countMap.set(row.seriesId, row.count)
  }
  return countMap
}

function mapSeriesCovers(rows: CoverCandidateRow[]): Map<number, FileSummary> {
  const coverMap = new Map<number, FileSummary>()
  for (const row of rows) {
    coverMap.set(row.id, toWaterfallSummary(row))
  }
  return coverMap
}

function mapSeriesPreviews(rows: PreviewCandidateRow[], limit: number): Map<number, FileSummary[]> {
  const previewMap = new Map<number, FileSummary[]>()
  for (const row of rows) {
    const current = previewMap.get(row.seriesId) ?? []
    if (current.length >= limit) {
      continue
    }
    current.push(toWaterfallSummary(row))
    previewMap.set(row.seriesId, current)
  }
  return previewMap
}

function mergeCoverAndPreviews(cover: FileSummary | null, previews: FileSummary[], limit: number): FileSummary[] {
  const merged: FileSummary[] = []
  const seen = new Set<number>()
  const append = (entry: FileSummary | null | undefined): void => {
    if (!entry || seen.has(entry.id)) {
      return
    }
    seen.add(entry.id)
    merged.push(entry)
  }

  append(cover)
  for (const preview of previews) {
    append(preview)
    if (merged.length >= limit) {
      break
    }
  }
  return merged
}

async function loadFallbackCovers(seriesIds: number[]): Promise<Map<number, FileSummary>> {
  const fallbackMap = new Map<number, FileSummary>()
  if (seriesIds.length === 0) {
    return fallbackMap
  }

  const rows = await db
    .select({
      seriesId: seriesFiles.seriesId,
      id: files.id,
      imageUrl: files.imageUrl,
      width: files.width,
      height: files.height,
      metadata: files.metadata,
    })
    .from(seriesFiles)
    .innerJoin(files, eq(files.id, seriesFiles.fileId))
    .where(inArray(seriesFiles.seriesId, seriesIds))
    .orderBy(
      asc(seriesFiles.seriesId),
      asc(seriesFiles.sortOrder),
      desc(files.captureTime),
      desc(files.createdAt),
      desc(files.id),
    )

  for (const row of rows) {
    if (fallbackMap.has(row.seriesId)) {
      continue
    }
    fallbackMap.set(row.seriesId, toWaterfallSummary(row))
  }
  return fallbackMap
}

export default defineEventHandler(async (): Promise<SeriesSummary[]> => {
  await ensureSeriesSchema()
  const [seriesRows, countRows] = await Promise.all([
    db
      .select({
        id: series.id,
        slug: series.slug,
        title: series.title,
        description: series.description,
        coverFileId: series.coverFileId,
        createdAt: series.createdAt,
        updatedAt: series.updatedAt,
      })
      .from(series)
      .orderBy(desc(series.createdAt), desc(series.id)),
    db
      .select({
        seriesId: seriesFiles.seriesId,
        count: sql<number>`count(*)`,
      })
      .from(seriesFiles)
      .groupBy(seriesFiles.seriesId),
  ])

  const coverFileIds = [...new Set(seriesRows.map(row => row.coverFileId).filter((id): id is number => typeof id === 'number'))]

  const coverRows = coverFileIds.length > 0
    ? await db
        .select({
          id: files.id,
          imageUrl: files.imageUrl,
          width: files.width,
          height: files.height,
          metadata: files.metadata,
        })
        .from(files)
        .where(inArray(files.id, coverFileIds))
    : []

  const counts = mapCounts(countRows)
  const coverByFileId = mapSeriesCovers(coverRows)
  const needsFallbackIds = seriesRows
    .filter(row => !row.coverFileId || !coverByFileId.has(row.coverFileId))
    .map(row => row.id)
  const fallbackCovers = await loadFallbackCovers(needsFallbackIds)
  const seriesIds = seriesRows.map(row => row.id)

  const previewRows = seriesIds.length > 0
    ? await db
        .select({
          seriesId: seriesFiles.seriesId,
          id: files.id,
          imageUrl: files.imageUrl,
          width: files.width,
          height: files.height,
          metadata: files.metadata,
        })
        .from(seriesFiles)
        .innerJoin(files, eq(files.id, seriesFiles.fileId))
        .where(inArray(seriesFiles.seriesId, seriesIds))
        .orderBy(
          asc(seriesFiles.seriesId),
          asc(seriesFiles.sortOrder),
          desc(files.captureTime),
          desc(files.createdAt),
          desc(files.id),
        )
    : []
  const previewBySeriesId = mapSeriesPreviews(previewRows, SERIES_PREVIEW_LIMIT)

  const mappedSeries = seriesRows.map((row: SeriesBaseRow) => {
    const directCover = row.coverFileId ? coverByFileId.get(row.coverFileId) ?? null : null
    const fallbackCover = fallbackCovers.get(row.id) ?? null
    const resolvedCover = directCover ?? fallbackCover
    const previews = mergeCoverAndPreviews(
      resolvedCover,
      previewBySeriesId.get(row.id) ?? [],
      SERIES_PREVIEW_LIMIT,
    )
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      coverFileId: row.coverFileId,
      cover: resolvedCover,
      previews,
      fileCount: counts.get(row.id) ?? 0,
      isVirtual: false,
      createdAt: toIsoString(row.createdAt),
      updatedAt: toIsoString(row.updatedAt),
    }
  })

  const [uncategorizedCountRows, uncategorizedPreviewRows] = await Promise.all([
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
      .limit(SERIES_PREVIEW_LIMIT),
  ])

  const uncategorizedCount = uncategorizedCountRows[0]?.count ?? 0
  if (uncategorizedCount <= 0) {
    return mappedSeries
  }

  const nowIso = new Date().toISOString()
  const uncategorizedPreviews = uncategorizedPreviewRows.map(row => toWaterfallSummary(row))
  const uncategorizedCover = uncategorizedPreviews[0] ?? null
  return [
    ...mappedSeries,
    {
      id: UNCATEGORIZED_SERIES_ID,
      slug: UNCATEGORIZED_SERIES_SLUG,
      title: 'Uncategorized',
      description: '',
      coverFileId: null,
      cover: uncategorizedCover,
      previews: uncategorizedPreviews,
      fileCount: uncategorizedCount,
      isVirtual: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ]
})
