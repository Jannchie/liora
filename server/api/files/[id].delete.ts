import type { H3Event } from 'h3'
import { createError, getRouterParam } from 'h3'
import { requireAdmin } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

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
  const existing = await prisma.file.findUnique({ where: { id } })

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'File not found.' })
  }

  await prisma.file.delete({ where: { id } })
  return { success: true }
})
