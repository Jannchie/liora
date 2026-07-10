import type { FileResponse } from '~/types/file'
import { asc, eq } from 'drizzle-orm'
import { db, series, seriesFiles } from '../../utils/db'
import { toFileResponse } from '../../utils/file-mapper'
import { requireFileById } from '../../utils/file-record'
import { handleJsonEtag } from '../../utils/http-cache'
import { requirePositiveIntRouterParam } from '../../utils/route-params'
import { ensureSeriesSchema } from '../../utils/series-schema'

export default defineEventHandler(async (event): Promise<FileResponse | null> => {
  await ensureSeriesSchema()
  const id = requirePositiveIntRouterParam(event, 'id', 'Invalid file id.')
  const [file, fileSeries] = await Promise.all([
    requireFileById(id),
    db
      .select({
        id: series.id,
        slug: series.slug,
        title: series.title,
      })
      .from(seriesFiles)
      .innerJoin(series, eq(series.id, seriesFiles.seriesId))
      .where(eq(seriesFiles.fileId, id))
      .orderBy(asc(seriesFiles.sortOrder), asc(series.id)),
  ])
  const response = toFileResponse(file, { series: fileSeries })
  if (handleJsonEtag(event, response)) {
    return null
  }
  return response
})
