import type { OrientationBackfillSummary } from '../../domain/files/orientation'
import { backfillOrientation } from '../../domain/files/orientation'
import { requireAdmin } from '../../utils/auth'

// Maintenance endpoint: the production image ships without node_modules, so
// the orientation backfill has to run inside the app rather than via tsx.

export default defineEventHandler(async (event): Promise<OrientationBackfillSummary> => {
  requireAdmin(event)
  return backfillOrientation()
})
