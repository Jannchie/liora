import type { HistogramBackfillSummary } from '../../domain/files/backfill-histogram'
import { backfillHistogram } from '../../domain/files/backfill-histogram'
import { requireAdmin } from '../../utils/auth'

export default defineEventHandler(async (event): Promise<HistogramBackfillSummary> => {
  requireAdmin(event)
  return backfillHistogram()
})
