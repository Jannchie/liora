import type { H3Event } from 'h3'
import type { FileResponse } from '~/types/file'
import { eq } from 'drizzle-orm'
import { createError, getRouterParam } from 'h3'
import { db, files } from '../../utils/db'
import { toFileResponse } from '../../utils/file-mapper'

function parseId(event: H3Event): number {
  const idParam = getRouterParam(event, 'id')
  const id = Number(idParam)
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid file id.' })
  }
  return id
}

export default defineEventHandler(async (event): Promise<FileResponse> => {
  setHeader(event, 'Cache-Control', 'no-store')
  setHeader(event, 'Pragma', 'no-cache')
  setHeader(event, 'Expires', '0')
  const id = parseId(event)
  const file = await db.query.files.findFirst({
    where: eq(files.id, id),
  })
  if (!file) {
    throw createError({ statusCode: 404, statusMessage: 'File not found.' })
  }
  return toFileResponse(file)
})
