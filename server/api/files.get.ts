import type { FileResponse } from '~/types/file'
import { desc } from 'drizzle-orm'
import { db, files } from '../utils/db'
import { toFileResponse } from '../utils/file-mapper'

export default defineEventHandler(async (): Promise<FileResponse[]> => {
  const rows = await db.query.files.findMany({
    orderBy: [desc(files.captureTime), desc(files.createdAt)],
  })

  return rows.map(file => toFileResponse(file))
})
