interface QueryPagination {
  limit: number | null
  offset: number | null
}

function resolveQueryValue(value: unknown): string | number | boolean | null {
  if (Array.isArray(value)) {
    for (const entry of value) {
      if (typeof entry === 'string' && entry.trim().length > 0) {
        return entry
      }
      if (typeof entry === 'number' && Number.isFinite(entry)) {
        return entry
      }
      if (typeof entry === 'boolean') {
        return entry
      }
    }
    return null
  }
  if (typeof value === 'string') {
    return value.trim().length > 0 ? value : null
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value === 'boolean') {
    return value
  }
  return null
}

function parseQueryNumber(value: unknown): number | null {
  const resolved = resolveQueryValue(value)
  if (typeof resolved === 'number') {
    return Number.isInteger(resolved) && resolved >= 0 ? resolved : null
  }
  if (typeof resolved !== 'string') {
    return null
  }
  const parsed = Number.parseInt(resolved, 10)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null
}

export function parseSeriesPagination(query: Record<string, unknown>): QueryPagination {
  return {
    limit: parseQueryNumber(query.limit),
    offset: parseQueryNumber(query.offset),
  }
}

export function normalizeSeriesText(value: string | null | undefined): string {
  return value?.trim() ?? ''
}

export function slugifySeriesTitle(value: string): string {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replaceAll(/[^a-z0-9\s-]+/g, '')
    .replaceAll(/[\s_-]+/g, '-')
    .replaceAll(/^-+|-+$/g, '')
}

export function normalizeSeriesSlug(value: string | null | undefined): string {
  return slugifySeriesTitle(normalizeSeriesText(value))
}

export function normalizeSeriesDescription(value: string | null | undefined): string {
  return normalizeSeriesText(value)
}

export function parseNumericId(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null
  }
  return parsed
}

export function parseUniqueFileIds(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return []
  }
  const ids = value
    .map(entry => parseNumericId(entry))
    .filter((entry): entry is number => typeof entry === 'number')
  return [...new Set(ids)]
}

export interface SeriesReorderItem {
  fileId: number
  sortOrder: number
}

export function parseSeriesReorderItems(value: unknown): SeriesReorderItem[] {
  if (!Array.isArray(value)) {
    return []
  }
  const normalized: SeriesReorderItem[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue
    }
    const fileId = parseNumericId((item as { fileId?: unknown }).fileId)
    const sortOrderRaw = (item as { sortOrder?: unknown }).sortOrder
    const sortOrderParsed = typeof sortOrderRaw === 'number' ? sortOrderRaw : Number(sortOrderRaw)
    if (!fileId || !Number.isInteger(sortOrderParsed) || sortOrderParsed < 0) {
      continue
    }
    normalized.push({
      fileId,
      sortOrder: sortOrderParsed,
    })
  }
  return normalized
}
