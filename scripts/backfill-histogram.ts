import type { HistogramData } from '../app/types/file'
import { computeHistogram } from '../server/utils/histogram'
import { prisma } from '../server/utils/prisma'

interface ParsedMetadata {
  histogram?: HistogramData | null
  [key: string]: unknown
}

function parseMetadata(raw: string): ParsedMetadata | null {
  try {
    const value = JSON.parse(raw)
    if (value && typeof value === 'object') {
      return value as ParsedMetadata
    }
    return {}
  }
  catch (error) {
    console.warn('Failed to parse metadata, skipping entry:', error)
    return null
  }
}

async function fetchImageBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`)
  }
  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

async function main(): Promise<void> {
  const files = await prisma.file.findMany({
    select: { id: true, imageUrl: true, metadata: true },
  })

  let updated = 0
  let skipped = 0

  for (const file of files) {
    const metadata = parseMetadata(file.metadata)
    if (!metadata) {
      skipped += 1
      continue
    }
    if (metadata.histogram) {
      skipped += 1
      continue
    }

    try {
      const buffer = await fetchImageBuffer(file.imageUrl)
      const histogram = await computeHistogram(buffer)
      if (!histogram) {
        console.warn(`Histogram generation failed for file #${file.id}`)
        skipped += 1
        continue
      }

      metadata.histogram = histogram
      await prisma.file.update({
        where: { id: file.id },
        data: { metadata: JSON.stringify(metadata) },
      })
      updated += 1

      console.log(`Updated histogram for file #${file.id}`)
    }
    catch (error) {
      console.warn(`Failed to update histogram for file #${file.id}:`, error)
      skipped += 1
    }
  }

  console.log(`Done. Updated ${updated}, skipped ${skipped}.`)
  await prisma.$disconnect()
}

await main().catch(async (error) => {
  console.error(error)
  await prisma.$disconnect()
  // eslint-disable-next-line unicorn/no-process-exit
  process.exit(1)
})
