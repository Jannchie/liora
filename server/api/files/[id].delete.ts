import type { H3Event } from 'h3'
import { eq } from 'drizzle-orm'
import { createError, getRouterParam } from 'h3'
import { requireAdmin } from '../../utils/auth'
import { db, files } from '../../utils/db'

function parseId(event: H3Event): number {
  const idParam = getRouterParam(event, 'id')
  const id = Number(idParam)
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid file id.' })
  }
  return id
}

export default defineEventHandler(async (event): Promise<{ success: boolean }> => {
  requireAdmin(event)
  const id = parseId(event)
  const existing = await db.query.files.findFirst({
    where: eq(files.id, id),
  })

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'File not found.' })
  }

  await db.delete(files).where(eq(files.id, id))
  return { success: true }
})
