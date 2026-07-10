import type { H3Event } from 'h3'
import type { FileRow } from './db'
import type { LivePhotoShareAssets } from './live-photo-share'
import { createReadStream } from 'node:fs'
import { eq } from 'drizzle-orm'
import { createError, sendStream, setHeader } from 'h3'
import { useRuntimeConfig } from '#imports'
import { db, files } from './db'
import { createLivePhotoShareAssets } from './live-photo-share'
import { extractKeyFromPublicUrl, openObjectStreamFromS3, requireS3Config } from './s3'

type LivePhotoAssetKind = 'image' | 'video'

export interface LivePhotoShareMetadata {
  parsed: Record<string, unknown>
  livePhotoVideoUrl?: string
  livePhotoStillTime: number
  shareImageUrl?: string
  shareVideoUrl?: string
  shareContentId?: string
}

export function parseLivePhotoShareMetadata(raw: string): LivePhotoShareMetadata {
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

function setDownloadHeaders(event: H3Event, contentType: string, filename: string): void {
  setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')
  setHeader(event, 'Content-Type', contentType)
  setHeader(event, 'Content-Disposition', `attachment; filename="${filename}"`)
}

async function streamFromS3(event: H3Event, url: string, contentType: string, filename: string): Promise<unknown> {
  const storageConfig = requireS3Config(useRuntimeConfig(event).storage)
  const key = extractKeyFromPublicUrl(storageConfig, url)
  if (!key) {
    throw createError({ statusCode: 500, statusMessage: 'Invalid cached live photo URL.' })
  }
  const { stream, contentLength } = await openObjectStreamFromS3({ key, config: storageConfig })
  setDownloadHeaders(event, contentType, filename)
  if (typeof contentLength === 'number') {
    setHeader(event, 'Content-Length', contentLength)
  }
  return sendStream(event, stream)
}

function registerCleanup(event: H3Event, cleanup: () => Promise<void>): void {
  event.node.res.once('close', () => {
    void cleanup()
  })
  event.node.res.once('finish', () => {
    void cleanup()
  })
}

async function persistShareMetadata(fileId: number, parsed: Record<string, unknown>, assets: LivePhotoShareAssets): Promise<void> {
  const nextMetadata = {
    ...parsed,
    livePhotoShareImageUrl: assets.imageUrl,
    livePhotoShareVideoUrl: assets.videoUrl,
    livePhotoShareContentId: assets.contentId,
  }
  await db
    .update(files)
    .set({ metadata: JSON.stringify(nextMetadata) })
    .where(eq(files.id, fileId))
}

export async function serveLivePhotoAsset(options: {
  event: H3Event
  file: FileRow
  metadata: LivePhotoShareMetadata
  asset: LivePhotoAssetKind
  contentType: string
  filename: string
}): Promise<unknown> {
  const cachedUrl = options.asset === 'image' ? options.metadata.shareImageUrl : options.metadata.shareVideoUrl
  if (options.metadata.shareImageUrl && options.metadata.shareVideoUrl && cachedUrl) {
    return streamFromS3(options.event, cachedUrl, options.contentType, options.filename)
  }

  const livePhotoVideoUrl = options.metadata.livePhotoVideoUrl?.trim()
  if (!livePhotoVideoUrl) {
    throw createError({ statusCode: 404, statusMessage: 'Live photo not available.' })
  }

  const storageConfig = requireS3Config(useRuntimeConfig(options.event).storage)
  const assets = await createLivePhotoShareAssets({
    file: options.file,
    livePhotoVideoUrl,
    livePhotoStillTime: options.metadata.livePhotoStillTime,
    contentId: options.metadata.shareContentId,
    config: storageConfig,
  })

  await persistShareMetadata(options.file.id, options.metadata.parsed, assets)
  registerCleanup(options.event, assets.cleanup)
  setDownloadHeaders(options.event, options.contentType, options.filename)
  const path = options.asset === 'image' ? assets.imagePath : assets.videoPath
  return sendStream(options.event, createReadStream(path))
}
