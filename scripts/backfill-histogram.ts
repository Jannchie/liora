import { backfillHistogram } from '../server/domain/files/backfill-histogram'
import { closeDb } from '../server/utils/db'

try {
  const summary = await backfillHistogram()
  console.log(`Backfill complete. Updated ${summary.updated}, skipped ${summary.skipped} of ${summary.total} records.`)
}
catch (error) {
  console.error('Backfill failed:', error)
  process.exitCode = 1
}
finally {
  await closeDb()
}
