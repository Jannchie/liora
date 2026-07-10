import type { FileResponse, FileSummary } from '~/types/file'
import { desc } from 'drizzle-orm'
import { getQuery } from 'h3'
import { parseListQuery, toWaterfallSummary, waterfallSummarySelection } from '../domain/files/listing'
import { db, files } from '../utils/db'
import { toFileResponse } from '../utils/file-mapper'
import { handleJsonEtag } from '../utils/http-cache'

export default defineEventHandler(async (event): Promise<FileResponse[] | FileSummary[] | null> => {
  const query = getQuery(event)
  const { limit, offset, waterfallOnly } = parseListQuery(query as Record<string, unknown>)

  if (waterfallOnly) {
    const baseQuery = db
      .select(waterfallSummarySelection())
      .from(files)
      .orderBy(desc(files.captureTime), desc(files.createdAt), desc(files.id))
    const limitedQuery = typeof limit === 'number' ? baseQuery.limit(limit) : baseQuery
    const offsetQuery = typeof offset === 'number' ? limitedQuery.offset(offset) : limitedQuery
    const rows = await offsetQuery
    const summaries = rows.map(row => toWaterfallSummary(row))
    if (handleJsonEtag(event, summaries)) {
      return null
    }
    return summaries
  }

  const rows = await db.query.files.findMany({
    orderBy: [desc(files.captureTime), desc(files.createdAt), desc(files.id)],
    ...(typeof limit === 'number' ? { limit } : {}),
    ...(typeof offset === 'number' ? { offset } : {}),
  })

  // The histogram (4×256 floats per row) dwarfs the rest of the payload and
  // is only consumed by the overlay, which refetches the single file anyway.
  const responses = rows.map((file) => {
    const response = toFileResponse(file)
    return { ...response, metadata: { ...response.metadata, histogram: null } }
  })
  if (handleJsonEtag(event, responses)) {
    return null
  }
  return responses
})
