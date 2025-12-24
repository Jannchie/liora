import type { FileResponse } from '~/types/file'
import { desc, sql } from 'drizzle-orm'
import { getQuery } from 'h3'
import { db, files } from '../utils/db'
import { toFileResponse } from '../utils/file-mapper'

type QueryInput = unknown

function resolveQueryValue(value: QueryInput): string | number | boolean | null {
  if (Array.isArray(value)) {
    for (const entry of value) {
      if (typeof entry === 'string') {
        if (entry.trim().length > 0) {
          return entry
        }
      }
      else if (typeof entry === 'number') {
        if (Number.isFinite(entry)) {
          return entry
        }
      }
      else if (typeof entry === 'boolean') {
        return entry
      }
    }
    return null
  }
  if (typeof value === 'string') {
    if (value.trim().length === 0) {
      return null
    }
    return value
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value === 'boolean') {
    return value
  }
  return null
}

function parseQueryNumber(value: QueryInput): number | null {
  const normalized = resolveQueryValue(value)
  if (typeof normalized === 'number') {
    return normalized >= 0 ? normalized : null
  }
  if (typeof normalized !== 'string') {
    return null
  }
  const parsed = Number.parseInt(normalized, 10)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null
  }
  return parsed
}

function parseQueryBoolean(value: QueryInput): boolean {
  const normalized = resolveQueryValue(value)
  if (typeof normalized === 'boolean') {
    return normalized
  }
  if (typeof normalized === 'number') {
    return normalized === 1
  }
  if (typeof normalized !== 'string') {
    return false
  }
  const trimmed = normalized.trim().toLowerCase()
  return trimmed === 'true' || trimmed === '1'
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
