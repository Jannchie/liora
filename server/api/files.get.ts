import type { FileResponse, FileSummary } from '~/types/file'
import { desc } from 'drizzle-orm'
import { getQuery } from 'h3'
import { parseListQuery, toWaterfallSummary } from '../domain/files/listing'
import { db, files } from '../utils/db'
import { toFileResponse } from '../utils/file-mapper'

export default defineEventHandler(async (event): Promise<FileResponse[] | FileSummary[]> => {
  setHeader(event, 'Cache-Control', 'no-store')
  setHeader(event, 'Pragma', 'no-cache')
  setHeader(event, 'Expires', '0')

  const query = getQuery(event)
  const { limit, offset, waterfallOnly } = parseListQuery(query as Record<string, unknown>)

  if (waterfallOnly) {
    const baseQuery = db
      .select({
        id: files.id,
        imageUrl: files.imageUrl,
        width: files.width,
        height: files.height,
        metadata: files.metadata,
      })
      .from(files)
      .orderBy(desc(files.captureTime), desc(files.createdAt))
    const limitedQuery = typeof limit === 'number' ? baseQuery.limit(limit) : baseQuery
    const offsetQuery = typeof offset === 'number' ? limitedQuery.offset(offset) : limitedQuery
    const rows = await offsetQuery
    return rows.map(row => toWaterfallSummary(row))
  }

  const rows = await db.query.files.findMany({
    orderBy: [desc(files.captureTime), desc(files.createdAt)],
    ...(typeof limit === 'number' ? { limit } : {}),
    ...(typeof offset === 'number' ? { offset } : {}),
  })

  return rows.map(file => toFileResponse(file))
})
