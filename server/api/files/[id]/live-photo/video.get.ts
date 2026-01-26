import type { H3Event } from 'h3'
import { createReadStream } from 'node:fs'
import { Readable } from 'node:stream'
import { eq } from 'drizzle-orm'
import { createError, getRouterParam, sendStream, setHeader } from 'h3'
import { db, files } from '../../../../utils/db'
import { resolveBaseName } from '../../../../utils/live-photo'
import { createLivePhotoShareAssets } from '../../../../utils/live-photo-share'
import { downloadObjectFromS3, extractKeyFromPublicUrl, requireS3Config } from '../../../../utils/s3'

function parseId(value: string | undefined): number {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid file id.' })
  }
  return parsed
}

function parseMetadata(raw: string): {
  parsed: Record<string, unknown>
  livePhotoVideoUrl?: string
  livePhotoStillTime: number
  shareImageUrl?: string
  shareVideoUrl?: string
  shareContentId?: string
} {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const livePhotoVideoUrl = typeof parsed.livePhotoVideoUrl === 'string' ? parsed.livePhotoVideoUrl : undefined
    const stillTimeRaw = typeof parsed.livePhotoStillTime === 'number'
      ? parsed.livePhotoStillTime
      : Number(parsed.livePhotoStillTime)
    const livePhotoStillTime = Number.isFinite(stillTimeRaw) && stillTimeRaw >= 0 ? stillTimeRaw : 0
    const shareImageUrl = typeof parsed.livePhotoShareImageUrl === 'string' ? parsed.livePhotoShareImageUrl : undefined
    const shareVideoUrl = typeof parsed.livePhotoShareVideoUrl === 'string' ? parsed.livePhotoShareVideoUrl : undefined
    const shareContentId = typeof parsed.livePhotoShareContentId === 'string' ? parsed.livePhotoShareContentId : undefined
    return {
      parsed,
      livePhotoVideoUrl,
      livePhotoStillTime,
      shareImageUrl,
      shareVideoUrl,
      shareContentId,
    }
  }
  catch {
    return { parsed: {}, livePhotoStillTime: 0 }
  }
}

async function streamFromS3(event: H3Event, url: string, contentType: string, filename: string): Promise<unknown> {
  const storageConfig = requireS3Config(useRuntimeConfig(event).storage)
  const key = extractKeyFromPublicUrl(storageConfig, url)
  if (!key) {
    throw createError({ statusCode: 500, statusMessage: 'Invalid cached live photo URL.' })
  }
  const { buffer } = await downloadObjectFromS3({ key, config: storageConfig })
  setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')
  setHeader(event, 'Content-Type', contentType)
  setHeader(event, 'Content-Disposition', `attachment; filename="${filename}"`)
  return sendStream(event, Readable.from(buffer))
}

export default defineEventHandler(async (event) => {
  const id = parseId(getRouterParam(event, 'id'))

  const file = await db.query.files.findFirst({
    where: eq(files.id, id),
  })
  if (!file) {
    throw createError({ statusCode: 404, statusMessage: 'File not found.' })
  }

  const metadata = parseMetadata(file.metadata)
  if (!metadata.livePhotoVideoUrl || metadata.livePhotoVideoUrl.trim().length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Live photo not available.' })
  }

  const baseName = resolveBaseName(file.title || file.originalName || `live-photo-${file.id}`)
  const videoFileName = `${baseName}.mov`

  if (metadata.shareImageUrl && metadata.shareVideoUrl) {
    return streamFromS3(event, metadata.shareVideoUrl, 'video/quicktime', videoFileName)
  }

  const storageConfig = requireS3Config(useRuntimeConfig(event).storage)
  const assets = await createLivePhotoShareAssets({
    file,
    livePhotoVideoUrl: metadata.livePhotoVideoUrl,
    livePhotoStillTime: metadata.livePhotoStillTime,
    contentId: metadata.shareContentId,
    config: storageConfig,
  })

  const nextMetadata = {
    ...metadata.parsed,
    livePhotoShareImageUrl: assets.imageUrl,
    livePhotoShareVideoUrl: assets.videoUrl,
    livePhotoShareContentId: assets.contentId,
  }
  await db
    .update(files)
    .set({ metadata: JSON.stringify(nextMetadata) })
    .where(eq(files.id, id))

  event.node.res.once('close', () => {
    void assets.cleanup()
  })
  event.node.res.once('finish', () => {
    void assets.cleanup()
  })

  setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')
  setHeader(event, 'Content-Type', 'video/quicktime')
  setHeader(event, 'Content-Disposition', `attachment; filename="${videoFileName}"`)
  return sendStream(event, createReadStream(assets.videoPath))
})
