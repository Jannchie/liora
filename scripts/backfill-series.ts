import { backfillSeries } from '../server/domain/files/backfill-series'
import { closeDb } from '../server/utils/db'

try {
  const summary = await backfillSeries()
  console.log(`Backfill complete. ${summary.createdSeries} series created, ${summary.linkedFiles} files linked.`)
}
catch (error) {
  console.error('[backfill-series] failed:', error)
  process.exitCode = 1
}
finally {
  await closeDb()
}
