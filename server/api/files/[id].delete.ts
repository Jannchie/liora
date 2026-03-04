import { eq } from 'drizzle-orm'
import { requireAdmin } from '../../utils/auth'
import { db, files } from '../../utils/db'
import { requireFileById } from '../../utils/file-record'
import { requirePositiveIntRouterParam } from '../../utils/route-params'

export default defineEventHandler(async (event): Promise<{ success: boolean }> => {
  requireAdmin(event)
  const id = requirePositiveIntRouterParam(event, 'id', 'Invalid file id.')
  await requireFileById(id)

  await db.delete(files).where(eq(files.id, id))
  return { success: true }
})
