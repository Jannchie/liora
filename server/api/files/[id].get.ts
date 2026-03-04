import type { FileResponse } from '~/types/file'
import { asc, eq } from 'drizzle-orm'
import { db, series, seriesFiles } from '../../utils/db'
import { toFileResponse } from '../../utils/file-mapper'
import { requireFileById } from '../../utils/file-record'
import { requirePositiveIntRouterParam } from '../../utils/route-params'
import { ensureSeriesSchema } from '../../utils/series-schema'

export default defineEventHandler(async (event): Promise<FileResponse> => {
  await ensureSeriesSchema()
  setHeader(event, 'Cache-Control', 'no-store')
  setHeader(event, 'Pragma', 'no-cache')
  setHeader(event, 'Expires', '0')
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
  return toFileResponse(file, { series: fileSeries })
})
