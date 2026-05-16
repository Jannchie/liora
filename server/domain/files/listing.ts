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

function parseMetadata(value: string | null | undefined): Record<string, unknown> | null {
  if (!value) {
    return null
  }
  try {
    return JSON.parse(value) as Record<string, unknown>
  }
  catch {
    return null
  }
}

function extractArthash(metadata: Record<string, unknown> | null): string | undefined {
  if (!metadata) {
    return undefined
  }
  return typeof metadata.arthash === 'string' ? metadata.arthash : undefined
}

function extractLivePhotoVideoUrl(metadata: Record<string, unknown> | null): string | undefined {
  if (!metadata) {
    return undefined
  }
  const value = metadata.livePhotoVideoUrl
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined
}

export function parseListQuery(query: Record<string, unknown>): { limit: number | null, offset: number | null, waterfallOnly: boolean } {
  return {
    limit: parseQueryNumber(query.limit),
    offset: parseQueryNumber(query.offset),
    waterfallOnly: parseQueryBoolean(query.waterfall),
  }
}

export function toWaterfallSummary(row: {
  id: number
  imageUrl: string | null
  width: number
  height: number
  metadata: string
}): {
  id: number
  imageUrl: string
  width: number
  height: number
  arthash?: string
  livePhotoVideoUrl?: string
} {
  const metadata = parseMetadata(row.metadata)
  return {
    id: row.id,
    imageUrl: row.imageUrl ?? '',
    width: row.width,
    height: row.height,
    arthash: extractArthash(metadata),
    livePhotoVideoUrl: extractLivePhotoVideoUrl(metadata),
  }
}
