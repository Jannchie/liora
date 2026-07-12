import type { SQL } from 'drizzle-orm'
import type { RecomposeParams } from '../../../shared/types/recompose'
import { sql } from 'drizzle-orm'
import { validateRecomposeParams } from '../../../shared/utils/recompose'
import { files } from '../../database/schema'

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

function metadataField(path: string, alias: string): SQL.Aliased<string | null> {
  // json_valid guards malformed rows the way the old JSON.parse fallback did.
  return sql<string | null>`case when json_valid(${files.metadata}) then json_extract(${files.metadata}, ${path}) end`.as(alias)
}

export interface WaterfallSummaryRow {
  id: number
  imageUrl: string | null
  width: number
  height: number
  arthash: string | null
  livePhotoVideoUrl: string | null
  /** JSON text of the authored framing (json_extract returns objects as JSON strings). */
  recompose: string | null
}

/**
 * Select fragment for waterfall summaries: pulls the two summary fields out of
 * the metadata JSON in SQL instead of shipping the whole blob (which includes
 * multi-KB histograms) to JS. Returns a fresh object per call so aliases are
 * not shared between query builders.
 */
export function waterfallSummarySelection(): {
  id: typeof files.id
  imageUrl: typeof files.imageUrl
  width: typeof files.width
  height: typeof files.height
  arthash: SQL.Aliased<string | null>
  livePhotoVideoUrl: SQL.Aliased<string | null>
  recompose: SQL.Aliased<string | null>
} {
  return {
    id: files.id,
    imageUrl: files.imageUrl,
    width: files.width,
    height: files.height,
    arthash: metadataField('$.arthash', 'arthash'),
    livePhotoVideoUrl: metadataField('$.livePhotoVideoUrl', 'livePhotoVideoUrl'),
    recompose: metadataField('$.recompose', 'recompose'),
  }
}

function parseSummaryRecompose(raw: string | null): RecomposeParams | undefined {
  if (typeof raw !== 'string' || raw.length === 0) {
    return undefined
  }
  try {
    return validateRecomposeParams(JSON.parse(raw)) ?? undefined
  }
  catch {
    return undefined
  }
}

export function parseListQuery(query: Record<string, unknown>): { limit: number | null, offset: number | null, waterfallOnly: boolean } {
  return {
    limit: parseQueryNumber(query.limit),
    offset: parseQueryNumber(query.offset),
    waterfallOnly: parseQueryBoolean(query.waterfall),
  }
}

export function toWaterfallSummary(row: WaterfallSummaryRow): {
  id: number
  imageUrl: string
  width: number
  height: number
  arthash?: string
  livePhotoVideoUrl?: string
  recompose?: RecomposeParams
} {
  return {
    id: row.id,
    imageUrl: row.imageUrl ?? '',
    width: row.width,
    height: row.height,
    arthash: typeof row.arthash === 'string' ? row.arthash : undefined,
    livePhotoVideoUrl: typeof row.livePhotoVideoUrl === 'string' && row.livePhotoVideoUrl.trim().length > 0
      ? row.livePhotoVideoUrl
      : undefined,
    recompose: parseSummaryRecompose(row.recompose),
  }
}
