import type { SeriesBackfillSummary } from '../../domain/files/backfill-series'
import { backfillSeries } from '../../domain/files/backfill-series'
import { requireAdmin } from '../../utils/auth'

export default defineEventHandler(async (event): Promise<SeriesBackfillSummary> => {
  requireAdmin(event)
  return backfillSeries()
})
