import type { BackfillSummary } from '../../domain/files/backfill-io'
import { backfillRecipes } from '../../domain/files/backfill-recipe'
import { requireAdmin } from '../../utils/auth'

export default defineEventHandler(async (event): Promise<BackfillSummary> => {
  requireAdmin(event)
  return backfillRecipes()
})
