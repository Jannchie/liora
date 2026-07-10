import { asc, eq } from 'drizzle-orm'
import sharp from 'sharp'
import { db, files } from '../../utils/db'
import { logger } from '../../utils/logger'

// Repair File.width/height for photos whose EXIF orientation rotates the
// image by 90° (orientations 5-8): historical uploads stored raw pixel
// dimensions, so portrait shots kept landscape dimensions. Also records
// metadata.orientation, which the focus-box overlay needs to map
// sensor-space FocusLocation coordinates into display space.

export interface OrientationBackfillSummary {
  total: number
  checked: number
  updated: number
  failed: number
}

function parseMetadata(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>
  }
  catch {
    return {}
  }
}

async function fetchImage(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      logger.warn('orientation backfill: image fetch failed', { url, status: response.status })
      return null
    }
    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }
  catch (error) {
    logger.warn('orientation backfill: image fetch failed', { url, error })
    return null
  }
}

export async function backfillOrientation(options?: { concurrency?: number }): Promise<OrientationBackfillSummary> {
  const targets = await db.query.files.findMany({
    columns: { id: true, imageUrl: true, width: true, height: true, metadata: true },
    orderBy: [asc(files.id)],
  })

  let checked = 0
  let updated = 0
  let failed = 0
  let cursor = 0

  const worker = async (): Promise<void> => {
    while (cursor < targets.length) {
      const file = targets[cursor]
      cursor += 1
      if (!file) {
        continue
      }

      const sourceUrl = file.imageUrl?.trim() ?? ''
      if (!sourceUrl) {
        failed += 1
        continue
      }

      const buffer = await fetchImage(sourceUrl)
      if (!buffer) {
        failed += 1
        continue
      }

      let orientedWidth: number | undefined
      let orientedHeight: number | undefined
      let orientation: number | undefined
      try {
        const imageMetadata = await sharp(buffer).metadata()
        orientedWidth = imageMetadata.autoOrient?.width ?? imageMetadata.width
        orientedHeight = imageMetadata.autoOrient?.height ?? imageMetadata.height
        orientation = imageMetadata.orientation
      }
      catch (error) {
        logger.warn('orientation backfill: metadata read failed', { fileId: file.id, error })
        failed += 1
        continue
      }

      if (!orientedWidth || !orientedHeight) {
        failed += 1
        continue
      }
      checked += 1

      const storedMetadata = parseMetadata(file.metadata)
      const dimensionsChanged = orientedWidth !== file.width || orientedHeight !== file.height
      const orientationChanged = storedMetadata.orientation !== orientation
      if (!dimensionsChanged && !orientationChanged) {
        continue
      }

      storedMetadata.orientation = orientation
      await db
        .update(files)
        .set({ width: orientedWidth, height: orientedHeight, metadata: JSON.stringify(storedMetadata) })
        .where(eq(files.id, file.id))

      logger.info('orientation backfill: updated file', {
        fileId: file.id,
        from: `${file.width}x${file.height}`,
        to: `${orientedWidth}x${orientedHeight}`,
        orientation: orientation ?? null,
      })
      updated += 1
    }
  }

  const concurrency = Math.max(1, options?.concurrency ?? 4)
  await Promise.all(Array.from({ length: Math.min(concurrency, targets.length) }, () => worker()))

  return { total: targets.length, checked, updated, failed }
}
