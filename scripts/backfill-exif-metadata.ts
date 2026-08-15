import { backfillExifMetadata } from '../server/domain/files/backfill-exif'
import { closeDb } from '../server/utils/db'

try {
  const summary = await backfillExifMetadata()
  console.log(`Backfill complete. Updated ${summary.updated}, skipped ${summary.skipped} of ${summary.total} records.`)
}
catch (error) {
  console.error('Backfill failed:', error)
  process.exitCode = 1
}
finally {
  await closeDb()
}
