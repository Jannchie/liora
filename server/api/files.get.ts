import type { FileResponse } from '~/types/file'
import { desc, sql } from 'drizzle-orm'
import { getQuery } from 'h3'
import { db, files } from '../utils/db'
import { toFileResponse } from '../utils/file-mapper'

function parseQueryNumber(value: string | string[] | undefined): number | null {
  if (typeof value !== 'string') {
    return null
  }
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null
  }
  return parsed
}

function parseQueryBoolean(value: string | string[] | undefined): boolean {
  if (typeof value !== 'string') {
    return false
  }
  const normalized = value.trim().toLowerCase()
  return normalized === 'true' || normalized === '1'
}

export default defineEventHandler(async (event): Promise<FileResponse[]> => {
  setHeader(event, 'Cache-Control', 'no-store')
  setHeader(event, 'Pragma', 'no-cache')
  setHeader(event, 'Expires', '0')
  const query = getQuery(event)
  const limit = parseQueryNumber(query.limit)
  const offset = parseQueryNumber(query.offset)
  const includeTotal = parseQueryBoolean(query.includeTotal)
  if (includeTotal) {
    const [summary] = await db
      .select({ total: sql<number>`count(*)` })
      .from(files)
    const totalCount = summary?.total ?? 0
    setHeader(event, 'X-Total-Count', String(totalCount))
  }
  const rows = await db.query.files.findMany({
    orderBy: [desc(files.captureTime), desc(files.createdAt)],
    ...(typeof limit === 'number' ? { limit } : {}),
    ...(typeof offset === 'number' ? { offset } : {}),
  })

  return rows.map(file => toFileResponse(file))
})
