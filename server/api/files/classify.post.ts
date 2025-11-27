import type { H3Event } from 'h3'
import type { GenreClassificationResult } from '../../utils/ai-classifier'
import { createError, readBody, readMultipartFormData } from 'h3'
import { classifyPhotoGenre, classifyPhotoGenreFromBuffer, deriveGenreLabel } from '../../utils/ai-classifier'
import { requireAdmin } from '../../utils/auth'

interface MultipartEntry {
  name: string
  filename?: string
  data: Buffer
}

interface ClassificationResponse {
  genre: string
  result: (Omit<GenreClassificationResult, 'updatedAt'> & { updatedAt: string }) | null
}

function isMultipartRequest(event: H3Event): boolean {
  const contentType = event.node.req.headers['content-type'] ?? ''
  return contentType.includes('multipart/form-data')
}

export default defineEventHandler(async (event): Promise<ClassificationResponse> => {
  requireAdmin(event)

  let classification: GenreClassificationResult | null = null

  if (isMultipartRequest(event)) {
    const form = await readMultipartFormData(event)
    if (!form) {
      throw createError({ statusCode: 400, statusMessage: 'Multipart form data is required.' })
    }
    const fileEntry = form.find(entry => entry.filename && entry.data?.length) as MultipartEntry | undefined
    if (!fileEntry) {
      throw createError({ statusCode: 400, statusMessage: 'Image file is required.' })
    }
    classification = await classifyPhotoGenreFromBuffer(event, fileEntry.data)
  }
  else {
    const body = await readBody<{ imageUrl?: string }>(event)
    const imageUrl = typeof body?.imageUrl === 'string' ? body.imageUrl.trim() : ''
    if (!imageUrl) {
      throw createError({ statusCode: 400, statusMessage: 'Image URL is required.' })
    }
    classification = await classifyPhotoGenre(event, imageUrl)
  }

  return {
    genre: deriveGenreLabel(classification),
    result: classification
      ? {
          ...classification,
          updatedAt: classification.updatedAt.toISOString(),
        }
      : null,
  }
})
