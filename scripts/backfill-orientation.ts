import { asc, eq } from 'drizzle-orm'
import sharp from 'sharp'
import { closeDb, db, files as filesTable } from '../server/utils/db'

// Fix File.width/height for photos whose EXIF orientation rotates the image
// by 90° (orientations 5-8): historical uploads stored the raw pixel
// dimensions, so portrait shots kept landscape dimensions in the database.
// Also records metadata.orientation, which the focus-box overlay needs to map
// sensor-space FocusLocation coordinates into display space.

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
      console.warn(`Skip ${url}: HTTP ${response.status}`)
      return null
    }
    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }
  catch (error) {
    console.warn(`Skip ${url}: ${String(error)}`)
    return null
  }
}

async function main(): Promise<void> {
  const files = await db.query.files.findMany({
    columns: { id: true, imageUrl: true, width: true, height: true, title: true, metadata: true },
    orderBy: [asc(filesTable.id)],
  })

  let updatedCount = 0
  let checkedCount = 0

  for (const file of files) {
    const sourceUrl = file.imageUrl?.trim() ?? ''
    if (!sourceUrl) {
      console.warn(`File #${file.id} has no usable image URL`)
      continue
    }

    const buffer = await fetchImage(sourceUrl)
    if (!buffer) {
      continue
    }
    checkedCount += 1

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
      console.warn(`Skip #${file.id}: failed to read metadata (${String(error)})`)
      continue
    }

    if (!orientedWidth || !orientedHeight) {
      console.warn(`Skip #${file.id}: no dimensions in metadata`)
      continue
    }

    const storedMetadata = parseMetadata(file.metadata)
    const dimensionsChanged = orientedWidth !== file.width || orientedHeight !== file.height
    const orientationChanged = storedMetadata.orientation !== orientation
    if (!dimensionsChanged && !orientationChanged) {
      continue
    }

    storedMetadata.orientation = orientation
    await db
      .update(filesTable)
      .set({ width: orientedWidth, height: orientedHeight, metadata: JSON.stringify(storedMetadata) })
      .where(eq(filesTable.id, file.id))

    console.log(`Updated #${file.id} (${file.title || 'untitled'}): ${file.width}x${file.height} -> ${orientedWidth}x${orientedHeight}, orientation=${orientation ?? 'none'}`)
    updatedCount += 1
  }

  console.log(`Backfill complete. Fixed dimensions for ${updatedCount} of ${checkedCount} checked records (${files.length} total).`)
}

try {
  await main()
}
catch (error) {
  console.error('Backfill failed:', error)
  process.exitCode = 1
}
finally {
  await closeDb()
}
