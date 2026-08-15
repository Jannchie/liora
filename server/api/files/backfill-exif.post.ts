import type { ExifBackfillSummary } from '../../domain/files/backfill-exif'
import { backfillExifMetadata } from '../../domain/files/backfill-exif'
import { requireAdmin } from '../../utils/auth'

export default defineEventHandler(async (event): Promise<ExifBackfillSummary> => {
  requireAdmin(event)
  return backfillExifMetadata()
})
