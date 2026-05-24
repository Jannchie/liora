import type { S3Config } from '../../utils/s3'
import type { UploadStatus } from '../../utils/upload-status'
import type { FileMetadata } from '~/types/file'
import { basename } from 'node:path'
import { eq } from 'drizzle-orm'
import { db, files } from '../../utils/db'
import { joinCharacters } from '../../utils/file-mapper'
import { extractFocusMetadataFromBuffer } from '../../utils/focus-metadata'
import { computeHistogram } from '../../utils/histogram'
import { logger } from '../../utils/logger'
import { buildPublicUrl, downloadObjectFromS3, headObjectFromS3, uploadBufferToS3 } from '../../utils/s3'
import { setUploadStatus } from '../../utils/upload-status'
import { computePerceptualHash, computeSha256, generateArthash, validateImage } from './image'
import { buildMetadata, normalizeText, parseCharacters, stripLensFromCamera, validateLengths } from './metadata'
import { assertMaxFileSize, buildImageKey, buildVideoKey } from './upload'

interface MultipartEntry {
  name: string
  filename?: string
  type?: string
  data: Buffer
}

interface MultipartUploadJobPayload {
  image: MultipartEntry
  video?: MultipartEntry
  fields: Record<string, string>
  storageConfig: S3Config
  uploadId: string
}

interface DirectUploadJobPayload {
  imageKey: string
  imageContentType?: string
  videoKey?: string
  videoContentType?: string
  originalName: string
  fields: Record<string, string>
  storageConfig: S3Config
  uploadId: string
}

function applyFocusMetadata(metadata: FileMetadata, focusMetadata: Awaited<ReturnType<typeof extractFocusMetadataFromBuffer>>): void {
  metadata.focusDistance = focusMetadata.focusDistance
  metadata.focusFrameSize = focusMetadata.focusFrameSize
  metadata.focusLocation = focusMetadata.focusLocation
  metadata.focusMode = focusMetadata.focusMode
  metadata.focusPosition = focusMetadata.focusPosition
  metadata.hasCrop = focusMetadata.hasCrop
  metadata.cropLeft = focusMetadata.cropLeft
  metadata.cropTop = focusMetadata.cropTop
  metadata.cropRight = focusMetadata.cropRight
  metadata.cropBottom = focusMetadata.cropBottom
  metadata.cropAngle = focusMetadata.cropAngle
  metadata.perspectiveHorizontal = focusMetadata.perspectiveHorizontal
  metadata.perspectiveVertical = focusMetadata.perspectiveVertical
  metadata.perspectiveRotate = focusMetadata.perspectiveRotate
  metadata.perspectiveScale = focusMetadata.perspectiveScale
  metadata.perspectiveUpright = focusMetadata.perspectiveUpright
  metadata.uprightTransform = focusMetadata.uprightTransform
  metadata.lightroomRecipe = focusMetadata.lightroomRecipe ?? metadata.lightroomRecipe
}

async function runMetadataPostProcessing(
  fileId: number,
  buffer: Buffer,
  baseMetadata: FileMetadata,
  uploadId: string,
): Promise<UploadStatus> {
  const nextMetadata: FileMetadata = { ...baseMetadata }
  let status: UploadStatus = 'completed'
  try {
    const [
      perceptualHash,
      histogram,
      arthash,
    ] = await Promise.all([
      computePerceptualHash(buffer),
      computeHistogram(buffer),
      generateArthash(buffer),
    ])
    if (perceptualHash) {
      nextMetadata.perceptualHash = perceptualHash
    }
    if (histogram) {
      nextMetadata.histogram = histogram
    }
    if (arthash) {
      nextMetadata.arthash = arthash
    }
  }
  catch (error) {
    status = 'failed'
    logger.error('post-upload metadata processing failed', { fileId, uploadId, error })
  }

  nextMetadata.processingStatus = status
  nextMetadata.uploadId = uploadId

  try {
    await db
      .update(files)
      .set({ metadata: JSON.stringify(nextMetadata) })
      .where(eq(files.id, fileId))
  }
  catch (error) {
    status = 'failed'
    logger.error('post-upload metadata persistence failed', { fileId, uploadId, error })
  }

  return status
}

async function insertFileRecord(payload: {
  width: number
  height: number
  imageUrl: string
  originalName: string
  title: string
  description: string
  genre: string
  metadata: FileMetadata
  characters: string[]
}): Promise<number> {
  const [created] = await db
    .insert(files)
    .values({
      title: payload.title,
      description: payload.description,
      originalName: payload.originalName,
      imageUrl: payload.imageUrl,
      width: payload.width,
      height: payload.height,
      fanworkTitle: payload.metadata.fanworkTitle,
      characterList: joinCharacters(payload.characters),
      location: payload.metadata.location,
      locationName: payload.metadata.locationName,
      latitude: payload.metadata.latitude,
      longitude: payload.metadata.longitude,
      cameraModel: payload.metadata.cameraModel,
      aperture: payload.metadata.aperture,
      focalLength: payload.metadata.focalLength,
      iso: payload.metadata.iso,
      shutterSpeed: payload.metadata.shutterSpeed,
      captureTime: payload.metadata.captureTime,
      metadata: JSON.stringify(payload.metadata),
      genre: payload.genre,
    })
    .returning({ id: files.id })

  if (!created) {
    throw new Error('Failed to create file record.')
  }

  return created.id
}

async function saveImage(file: MultipartEntry, config: S3Config, contentType: string | undefined): Promise<string> {
  return uploadBufferToS3({
    key: buildImageKey(file.filename),
    data: file.data,
    contentType,
    config,
  })
}

async function saveVideo(file: MultipartEntry, config: S3Config): Promise<string> {
  return uploadBufferToS3({
    key: buildVideoKey(file.filename),
    data: file.data,
    contentType: file.type?.trim() || 'video/mp4',
    config,
  })
}

async function processUploadCore(payload: {
  buffer: Buffer
  width: number
  height: number
  originalName: string
  fields: Record<string, string>
  imageUrl: string
  livePhotoVideoUrl?: string
  uploadId: string
}): Promise<{ fileId: number, metadata: FileMetadata }> {
  const characters = parseCharacters(payload.fields.characters)
  const metadata = buildMetadata(payload.fields, characters)
  const normalizedTitle = normalizeText(payload.fields.title)
  const normalizedDescription = normalizeText(payload.fields.description)
  const normalizedGenre = normalizeText(payload.fields.genre)
  metadata.processingStatus = 'processing'
  metadata.uploadId = payload.uploadId
  metadata.fileSize = payload.buffer.length
  metadata.sha256 = computeSha256(payload.buffer)
  const deduped = stripLensFromCamera(metadata.cameraModel, metadata.lensModel)
  metadata.cameraModel = deduped.cameraModel
  metadata.lensModel = deduped.lensModel
  const focusMetadata = await extractFocusMetadataFromBuffer(payload.buffer, payload.originalName)
  applyFocusMetadata(metadata, focusMetadata)
  if (payload.livePhotoVideoUrl) {
    metadata.livePhotoVideoUrl = payload.livePhotoVideoUrl
  }

  validateLengths({
    title: normalizedTitle,
    description: normalizedDescription,
    genre: normalizedGenre,
    metadata,
    characters,
    originalName: payload.originalName,
  })

  const fileId = await insertFileRecord({
    width: payload.width,
    height: payload.height,
    imageUrl: payload.imageUrl,
    originalName: payload.originalName,
    title: normalizedTitle,
    description: normalizedDescription,
    genre: normalizedGenre,
    metadata,
    characters,
  })

  return { fileId, metadata }
}

export async function processMultipartUpload(payload: MultipartUploadJobPayload): Promise<void> {
  const { image, video, fields, storageConfig, uploadId } = payload
  try {
    const { width, height, contentType } = await validateImage(image)
    const imageUrl = await saveImage(image, storageConfig, contentType)
    const livePhotoVideoUrl = video ? await saveVideo(video, storageConfig) : undefined
    const originalName = image.filename ? basename(image.filename) : ''
    const { fileId, metadata } = await processUploadCore({
      buffer: image.data,
      width,
      height,
      originalName,
      fields,
      imageUrl,
      livePhotoVideoUrl,
      uploadId,
    })
    const status = await runMetadataPostProcessing(fileId, image.data, metadata, uploadId)
    setUploadStatus(uploadId, status)
  }
  catch (error) {
    setUploadStatus(uploadId, 'failed')
    logger.error('multipart upload job failed', { uploadId, originalName: image.filename, error })
  }
}

export async function processDirectUpload(payload: DirectUploadJobPayload): Promise<void> {
  const { imageKey, imageContentType, videoKey, originalName, fields, storageConfig, uploadId } = payload
  try {
    const { buffer, contentType, contentLength } = await downloadObjectFromS3({
      key: imageKey,
      config: storageConfig,
    })
    if (typeof contentLength === 'number') {
      assertMaxFileSize(contentLength, 'Image')
    }
    assertMaxFileSize(buffer.length, 'Image')

    const image: MultipartEntry = {
      name: 'image',
      filename: originalName,
      type: imageContentType ?? contentType,
      data: buffer,
    }
    const { width, height } = await validateImage(image)

    if (videoKey) {
      const head = await headObjectFromS3({
        key: videoKey,
        config: storageConfig,
      })
      if (typeof head.contentLength === 'number') {
        assertMaxFileSize(head.contentLength, 'Video')
      }
    }

    const imageUrl = buildPublicUrl(storageConfig, imageKey)
    const livePhotoVideoUrl = videoKey ? buildPublicUrl(storageConfig, videoKey) : undefined
    const { fileId, metadata } = await processUploadCore({
      buffer,
      width,
      height,
      originalName,
      fields,
      imageUrl,
      livePhotoVideoUrl,
      uploadId,
    })
    const status = await runMetadataPostProcessing(fileId, buffer, metadata, uploadId)
    setUploadStatus(uploadId, status)
  }
  catch (error) {
    setUploadStatus(uploadId, 'failed')
    logger.error('direct upload job failed', { uploadId, imageKey, originalName, error })
  }
}

const BACKGROUND_UPLOAD_TIMEOUT_MS = Number(process.env.UPLOAD_JOB_TIMEOUT_MS ?? '120000')

export function startBackgroundUpload(task: () => Promise<void>, context: { uploadId: string }): void {
  setTimeout(() => {
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error(`upload job exceeded ${BACKGROUND_UPLOAD_TIMEOUT_MS}ms timeout`)),
        BACKGROUND_UPLOAD_TIMEOUT_MS,
      ).unref()
    })
    Promise.race([task(), timeout]).catch((error: unknown) => {
      setUploadStatus(context.uploadId, 'failed')
      logger.error('background upload task failed', { uploadId: context.uploadId, error })
    })
  }, 0)
}

export { MAX_FILE_SIZE_BYTES } from './upload'
