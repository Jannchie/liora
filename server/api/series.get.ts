import type { FileSummary } from '~/types/file'
import type { SeriesSummary } from '~/types/series'
import { asc, desc, eq, inArray, lte, notExists, sql } from 'drizzle-orm'
import { toWaterfallSummary, waterfallSummarySelection } from '../domain/files/listing'
import { toIsoString } from '../domain/series/service'
import { db, files, series, seriesFiles } from '../utils/db'
import { handleJsonEtag } from '../utils/http-cache'
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

const UNCATEGORIZED_SERIES_ID = 0
const UNCATEGORIZED_SERIES_SLUG = '__uncategorized__'
const SERIES_PREVIEW_LIMIT = 8

function mapCounts(rows: SeriesCountRow[]): Map<number, number> {
  const countMap = new Map<number, number>()
  for (const row of rows) {
    countMap.set(row.seriesId, row.count)
  }
  return countMap
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

async function loadSeriesPreviews(seriesIds: number[]): Promise<Map<number, FileSummary[]>> {
  const previewMap = new Map<number, FileSummary[]>()
  if (seriesIds.length === 0) {
    return previewMap
  }

  // Window the join per series so only the first SERIES_PREVIEW_LIMIT files of
  // each series ever leave the database, instead of loading every member row.
  const candidates = db
    .select({
      seriesId: seriesFiles.seriesId,
      ...waterfallSummarySelection(),
      rowNumber: sql<number>`row_number() over (partition by ${seriesFiles.seriesId} order by ${seriesFiles.sortOrder} asc, ${files.captureTime} desc, ${files.createdAt} desc, ${files.id} desc)`.as('rowNumber'),
    })
    .from(seriesFiles)
    .innerJoin(files, eq(files.id, seriesFiles.fileId))
    .where(inArray(seriesFiles.seriesId, seriesIds))
    .as('previewCandidates')

  const rows = await db
    .select({
      seriesId: candidates.seriesId,
      id: candidates.id,
      imageUrl: candidates.imageUrl,
      width: candidates.width,
      height: candidates.height,
      arthash: candidates.arthash,
      livePhotoVideoUrl: candidates.livePhotoVideoUrl,
      recompose: candidates.recompose,
    })
    .from(candidates)
    .where(lte(candidates.rowNumber, SERIES_PREVIEW_LIMIT))
    .orderBy(asc(candidates.seriesId), asc(candidates.rowNumber))

  for (const row of rows) {
    const current = previewMap.get(row.seriesId) ?? []
    current.push(toWaterfallSummary(row))
    previewMap.set(row.seriesId, current)
  }
  return previewMap
}

export default defineEventHandler(async (event): Promise<SeriesSummary[] | null> => {
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
        .select(waterfallSummarySelection())
        .from(files)
        .where(inArray(files.id, coverFileIds))
    : []

  const counts = mapCounts(countRows)
  const coverByFileId = new Map<number, FileSummary>(coverRows.map(row => [row.id, toWaterfallSummary(row)]))
  const previewBySeriesId = await loadSeriesPreviews(seriesRows.map(row => row.id))

  const mappedSeries = seriesRows.map((row: SeriesBaseRow) => {
    const directCover = row.coverFileId ? coverByFileId.get(row.coverFileId) ?? null : null
    const previews = previewBySeriesId.get(row.id) ?? []
    // The preview window shares the fallback-cover ordering, so the first
    // preview is exactly the cover the old per-series fallback query produced.
    const resolvedCover = directCover ?? previews[0] ?? null
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      coverFileId: row.coverFileId,
      cover: resolvedCover,
      previews: mergeCoverAndPreviews(resolvedCover, previews, SERIES_PREVIEW_LIMIT),
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
      .limit(SERIES_PREVIEW_LIMIT),
  ])

  const uncategorizedCount = uncategorizedCountRows[0]?.count ?? 0
  if (uncategorizedCount <= 0) {
    if (handleJsonEtag(event, mappedSeries)) {
      return null
    }
    return mappedSeries
  }

  const nowIso = new Date().toISOString()
  const uncategorizedPreviews = uncategorizedPreviewRows.map(row => toWaterfallSummary(row))
  const uncategorizedCover = uncategorizedPreviews[0] ?? null
  const summaries = [
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
  // Exclude the virtual entry's per-request timestamps from the ETag so
  // unchanged listings still revalidate to a 304.
  if (handleJsonEtag(event, summaries.map(entry => entry.isVirtual ? { ...entry, createdAt: '', updatedAt: '' } : entry))) {
    return null
  }
  return summaries
})
