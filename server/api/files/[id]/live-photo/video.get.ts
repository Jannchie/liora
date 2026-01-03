import { randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { eq } from 'drizzle-orm'
import { createError, getQuery, getRouterParam, sendStream, setHeader } from 'h3'
import { db, files } from '../../../../utils/db'
import { createLivePhotoVideo, resolveBaseName } from '../../../../utils/live-photo'

type QueryValue = string | string[] | undefined

function parseId(value: string | undefined): number {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid file id.' })
  }
  return parsed
}

function parseContentId(value: QueryValue): string {
  const resolved = Array.isArray(value) ? value.find(item => item.trim().length > 0) : value
  const trimmed = resolved?.trim() ?? ''
  return trimmed.length > 0 ? trimmed : randomUUID()
}

function parseMetadata(raw: string): { livePhotoVideoUrl?: string, livePhotoStillTime?: number } {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const livePhotoVideoUrl = typeof parsed.livePhotoVideoUrl === 'string' ? parsed.livePhotoVideoUrl : undefined
    const stillTimeRaw = typeof parsed.livePhotoStillTime === 'number'
      ? parsed.livePhotoStillTime
      : Number(parsed.livePhotoStillTime)
    const livePhotoStillTime = Number.isFinite(stillTimeRaw) && stillTimeRaw >= 0 ? stillTimeRaw : 0
    return { livePhotoVideoUrl, livePhotoStillTime }
  }
  catch {
    return {}
  }
}

export default defineEventHandler(async (event) => {
  const id = parseId(getRouterParam(event, 'id'))
  const query = getQuery(event)
  const contentId = parseContentId(query.contentId as QueryValue)

  const file = await db.query.files.findFirst({
    where: eq(files.id, id),
  })
  if (!file) {
    throw createError({ statusCode: 404, statusMessage: 'File not found.' })
  }

  const { livePhotoVideoUrl, livePhotoStillTime } = parseMetadata(file.metadata)
  if (!livePhotoVideoUrl || livePhotoVideoUrl.trim().length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Live photo not available.' })
  }

  const baseName = resolveBaseName(file.title || file.originalName || `live-photo-${file.id}`)
  const asset = await createLivePhotoVideo(livePhotoVideoUrl, contentId, livePhotoStillTime ?? 0, baseName)

  event.node.res.once('close', () => {
    void asset.cleanup()
  })
  event.node.res.once('finish', () => {
    void asset.cleanup()
  })

  setHeader(event, 'Cache-Control', 'no-store')
  setHeader(event, 'Content-Type', 'video/quicktime')
  setHeader(event, 'Content-Disposition', `attachment; filename="${asset.fileName}"`)
  return sendStream(event, createReadStream(asset.filePath))
})
