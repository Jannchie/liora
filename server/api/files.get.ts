import type { FileResponse } from '~/types/file'
import { toFileResponse } from '../utils/file-mapper'
import { prisma } from '../utils/prisma'

export default defineEventHandler(async (): Promise<FileResponse[]> => {
  const files = await prisma.file.findMany({
    orderBy: [{ captureTime: 'desc' }, { createdAt: 'desc' }],
  })

  return files.map(file => toFileResponse(file))
})
