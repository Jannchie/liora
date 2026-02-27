import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { slugifySeriesTitle } from '../server/domain/series/service'
import { closeDb, db, files, series, seriesFiles } from '../server/utils/db'

interface FileCandidate {
  id: number
  fanworkTitle: string
  captureTime: string
  createdAt: string
}

interface FileOrderCandidate {
  id: number
  captureTime: string
  createdAt: string
}

interface SeriesCandidate {
  id: number
  title: string
  slug: string
  coverFileId: number | null
}

function normalizeTitle(value: string): string {
  return value.trim()
}

function toTimestamp(value: string): number {
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) {
    return 0
  }
  return parsed
}

function sortFiles(input: FileOrderCandidate[]): FileOrderCandidate[] {
  return input.toSorted((left, right) => {
    const captureDiff = toTimestamp(right.captureTime) - toTimestamp(left.captureTime)
    if (captureDiff !== 0) {
      return captureDiff
    }
    const createdDiff = toTimestamp(right.createdAt) - toTimestamp(left.createdAt)
    if (createdDiff !== 0) {
      return createdDiff
    }
    return right.id - left.id
  })
}

async function resolveUniqueSlug(baseSlug: string, existingBySlug: Set<string>): Promise<string> {
  const normalized = baseSlug.trim() || 'series'
  let candidate = normalized
  let index = 2
  while (existingBySlug.has(candidate)) {
    candidate = `${normalized}-${index}`
    index += 1
  }
  existingBySlug.add(candidate)
  return candidate
}

async function main(): Promise<void> {
  const candidates = await db
    .select({
      id: files.id,
      fanworkTitle: files.fanworkTitle,
      captureTime: files.captureTime,
      createdAt: files.createdAt,
    })
    .from(files)
    .where(sql`trim(${files.fanworkTitle}) <> ''`)

  if (candidates.length === 0) {
    console.info('[backfill-series] no files with fanworkTitle found, nothing to do.')
    return
  }

  const grouped = new Map<string, FileCandidate[]>()
  for (const item of candidates) {
    const title = normalizeTitle(item.fanworkTitle)
    if (!title) {
      continue
    }
    const list = grouped.get(title) ?? []
    list.push(item)
    grouped.set(title, list)
  }

  const existingSeries = await db
    .select({
      id: series.id,
      title: series.title,
      slug: series.slug,
      coverFileId: series.coverFileId,
    })
    .from(series)

  const byTitle = new Map<string, SeriesCandidate>()
  const usedSlugs = new Set<string>()
  for (const item of existingSeries) {
    byTitle.set(item.title.trim(), item)
    usedSlugs.add(item.slug)
  }

  for (const [title, filesInGroup] of grouped.entries()) {
    let targetSeries = byTitle.get(title)

    if (!targetSeries) {
      const baseSlug = slugifySeriesTitle(title) || 'series'
      const uniqueSlug = await resolveUniqueSlug(baseSlug, usedSlugs)
      const [created] = await db
        .insert(series)
        .values({
          title,
          slug: uniqueSlug,
          description: '',
          coverFileId: null,
        })
        .returning()
      if (!created) {
        continue
      }
      targetSeries = created
      byTitle.set(title, created)

      console.info(`[backfill-series] created series "${title}" (${uniqueSlug})`)
    }

    const ordered = sortFiles(filesInGroup)
    const orderedIds = ordered.map(item => item.id)

    if (orderedIds.length === 0) {
      continue
    }

    const existingRelations = await db
      .select({
        fileId: seriesFiles.fileId,
      })
      .from(seriesFiles)
      .where(and(eq(seriesFiles.seriesId, targetSeries.id), inArray(seriesFiles.fileId, orderedIds)))

    const existingSet = new Set(existingRelations.map(item => item.fileId))

    const currentMaxOrder = await db
      .select({ maxSort: sql<number>`max(${seriesFiles.sortOrder})` })
      .from(seriesFiles)
      .where(eq(seriesFiles.seriesId, targetSeries.id))

    const baseSort = Number.isInteger(currentMaxOrder[0]?.maxSort) ? currentMaxOrder[0].maxSort : 0
    const newEntries = orderedIds.filter(fileId => !existingSet.has(fileId))

    if (newEntries.length > 0) {
      await db.insert(seriesFiles).values(
        newEntries.map((fileId, index) => ({
          seriesId: targetSeries.id,
          fileId,
          sortOrder: baseSort + index + 1,
        })),
      )

      console.info(`[backfill-series] linked ${newEntries.length} files to "${title}"`)
    }

    if (!targetSeries.coverFileId) {
      const firstFileId = orderedIds[0] ?? null
      if (firstFileId) {
        await db
          .update(series)
          .set({
            coverFileId: firstFileId,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          })
          .where(eq(series.id, targetSeries.id))
      }
    }
  }

  const finalSeries = await db
    .select({ id: series.id })
    .from(series)
    .orderBy(asc(series.id))

  console.info(`[backfill-series] completed. total series: ${finalSeries.length}`)
}

try {
  await main()
}
catch (error) {
  console.error('[backfill-series] failed:', error)
  process.exitCode = 1
}
finally {
  await closeDb()
}
