import type { FileRow } from './db'
import type { S3Config } from './s3'
import { randomUUID } from 'node:crypto'
import { createLivePhotoImage, createLivePhotoVideo, resolveBaseName } from './live-photo'
import { uploadFileToS3 } from './s3'

export interface LivePhotoShareAssets {
  imageUrl: string
  videoUrl: string
  contentId: string
  imagePath: string
  videoPath: string
  cleanup: () => Promise<void>
}

export async function createLivePhotoShareAssets(options: {
  file: FileRow
  livePhotoVideoUrl: string
  livePhotoStillTime: number
  contentId?: string
  config: S3Config
}): Promise<LivePhotoShareAssets> {
  const baseName = resolveBaseName(options.file.title || options.file.originalName || `live-photo-${options.file.id}`)
  const contentId = options.contentId?.trim() || randomUUID()
  const prefix = `live-photo/share/${options.file.id}/${contentId}`
  const cacheControl = 'public, max-age=31536000, immutable'
  const imageAsset = await createLivePhotoImage(options.file.imageUrl, contentId, baseName)
  const videoAsset = await createLivePhotoVideo(
    options.livePhotoVideoUrl,
    contentId,
    options.livePhotoStillTime,
    baseName,
  )

  try {
    const imageUrl = await uploadFileToS3({
      key: `${prefix}/${baseName}.jpg`,
      filePath: imageAsset.filePath,
      contentType: 'image/jpeg',
      contentDisposition: `attachment; filename="${baseName}.jpg"`,
      cacheControl,
      config: options.config,
    })
    const videoUrl = await uploadFileToS3({
      key: `${prefix}/${baseName}.mov`,
      filePath: videoAsset.filePath,
      contentType: 'video/quicktime',
      contentDisposition: `attachment; filename="${baseName}.mov"`,
      cacheControl,
      config: options.config,
    })

    return {
      imageUrl,
      videoUrl,
      contentId,
      imagePath: imageAsset.filePath,
      videoPath: videoAsset.filePath,
      cleanup: async (): Promise<void> => {
        await Promise.all([imageAsset.cleanup(), videoAsset.cleanup()])
      },
    }
  }
  catch (error) {
    await Promise.all([imageAsset.cleanup(), videoAsset.cleanup()])
    throw error
  }
}
