import { backfillOrientation } from '../server/domain/files/orientation'
import { closeDb } from '../server/utils/db'

// Local/CLI wrapper around the shared backfill; against a deployed instance
// use POST /api/files/backfill-orientation instead (the production image has
// no node_modules to run this script with).

try {
  const summary = await backfillOrientation()
  console.log(`Backfill complete. Fixed ${summary.updated} of ${summary.checked} checked records (${summary.total} total, ${summary.failed} failed).`)
}
catch (error) {
  console.error('Backfill failed:', error)
  process.exitCode = 1
}
finally {
  await closeDb()
}
