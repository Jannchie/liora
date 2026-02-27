import type { H3Event } from 'h3'
import type { FileResponse } from '~/types/file'
import { asc, eq } from 'drizzle-orm'
import { createError, getRouterParam } from 'h3'
import { db, files, series, seriesFiles } from '../../utils/db'
import { toFileResponse } from '../../utils/file-mapper'
import { ensureSeriesSchema } from '../../utils/series-schema'

function parseId(event: H3Event): number {
  const idParam = getRouterParam(event, 'id')
  const id = Number(idParam)
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid file id.' })
  }
  return id
}

export default defineEventHandler(async (event): Promise<FileResponse> => {
  await ensureSeriesSchema()
  setHeader(event, 'Cache-Control', 'no-store')
  setHeader(event, 'Pragma', 'no-cache')
  setHeader(event, 'Expires', '0')
  const id = parseId(event)
  const [file, fileSeries] = await Promise.all([
    db.query.files.findFirst({
      where: eq(files.id, id),
    }),
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
  if (!file) {
    throw createError({ statusCode: 404, statusMessage: 'File not found.' })
  }
  return toFileResponse(file, { series: fileSeries })
})
