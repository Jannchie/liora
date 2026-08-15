import { backfillArthash } from '../server/domain/files/backfill-arthash'
import { closeDb } from '../server/utils/db'

try {
  const summary = await backfillArthash()
  console.log(`Backfill complete. Added arthash for ${summary.updated} of ${summary.total} records (${summary.skipped} skipped).`)
}
catch (error) {
  console.error('Backfill failed:', error)
  process.exitCode = 1
}
finally {
  await closeDb()
}
