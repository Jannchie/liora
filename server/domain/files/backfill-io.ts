import { logger } from '../../utils/logger'

// I/O shared by the backfill jobs that re-read every stored original.

export async function fetchImageBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`)
  }
  return Buffer.from(await response.arrayBuffer())
}

/** A file row's metadata JSON as an object; `null` when it does not parse. */
export function parseMetadataObject(raw: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(raw)
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  }
  catch (error) {
    logger.warn('Failed to parse metadata, skipping entry:', { error })
    return null
  }
}

export interface BackfillSummary {
  total: number
  updated: number
  skipped: number
}
