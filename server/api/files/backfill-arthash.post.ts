import type { ArthashBackfillSummary } from '../../domain/files/backfill-arthash'
import { backfillArthash } from '../../domain/files/backfill-arthash'
import { requireAdmin } from '../../utils/auth'

export default defineEventHandler(async (event): Promise<ArthashBackfillSummary> => {
  requireAdmin(event)
  return backfillArthash()
})
