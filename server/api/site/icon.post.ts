import type { H3Event } from 'h3'
import type { SiteSettings } from '~/types/site'
import { randomUUID } from 'node:crypto'
import { extname } from 'node:path'
import sharp from 'sharp'
import { requireAdmin } from '../../utils/auth'
import { requireS3Config, uploadBufferToS3 } from '../../utils/s3'
import { updateSiteIcon } from '../../utils/site-settings'

interface MultipartEntry {
  name: string
  filename?: string
  type?: string
  data: Buffer
}

const MAX_ICON_BYTES = 1024 * 1024
const OUTPUT_CONTENT_TYPE = 'image/png'
const ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.ico', '.svg', '.avif'])
const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/avif',
  'image/svg+xml',
  'image/x-icon',
  'image/vnd.microsoft.icon',
])

function pickIconFile(form: MultipartEntry[] | null | undefined): MultipartEntry {
  if (!form) {
    throw createError({ statusCode: 400, statusMessage: '需要上传图标文件。' })
  }
  const entry = form.find(item => item.filename && item.data?.length) as MultipartEntry | undefined
  if (!entry) {
    throw createError({ statusCode: 400, statusMessage: '需要上传图标文件。' })
  }
  return entry
}

function assertIconType(entry: MultipartEntry): void {
  const extension = extname(entry.filename?.toLowerCase() ?? '')
  const normalizedType = entry.type?.toLowerCase() ?? ''
  const matchesExtension = extension.length > 0 && ALLOWED_EXTENSIONS.has(extension)
  const matchesMime = normalizedType.length > 0 && ALLOWED_MIME_TYPES.has(normalizedType)
  if (!matchesExtension && !matchesMime) {
    throw createError({ statusCode: 400, statusMessage: '只支持上传常见图片格式（png/jpg/webp/svg/ico）。' })
  }
}

function assertIconSize(entry: MultipartEntry): void {
  const size = entry.data?.length ?? 0
  if (size <= 0) {
    throw createError({ statusCode: 400, statusMessage: '图标文件为空。' })
  }
  if (size > MAX_ICON_BYTES) {
    throw createError({ statusCode: 400, statusMessage: '图标文件过大，请控制在 1MB 以内。' })
  }
}

function buildKey(extension: string): string {
  const timestamp = Date.now().toString(36)
  const id = randomUUID()
  const normalizedExt = extension.startsWith('.') ? extension : `.${extension}`
  return `site/icon-${timestamp}-${id}${normalizedExt}`
}

function resolveExtension(entry: MultipartEntry): string {
  const fromName = extname(entry.filename?.toLowerCase() ?? '')
  if (fromName) {
    return fromName
  }
  const mime = entry.type?.toLowerCase() ?? ''
  if (mime === 'image/svg+xml') {
    return '.svg'
  }
  if (mime === 'image/x-icon' || mime === 'image/vnd.microsoft.icon') {
    return '.ico'
  }
  if (mime === 'image/webp') {
    return '.webp'
  }
  if (mime === 'image/avif') {
    return '.avif'
  }
  if (mime === 'image/jpeg') {
    return '.jpg'
  }
  if (mime === 'image/png') {
    return '.png'
  }
  return '.png'
}

function resolveContentType(extension: string, fallback: string | undefined): string {
  const ext = extension.toLowerCase()
  if (ext === '.svg') {
    return 'image/svg+xml'
  }
  if (ext === '.ico') {
    return 'image/x-icon'
  }
  if (ext === '.webp') {
    return 'image/webp'
  }
  if (ext === '.avif') {
    return 'image/avif'
  }
  if (ext === '.jpg' || ext === '.jpeg') {
    return 'image/jpeg'
  }
  if (ext === '.png') {
    return 'image/png'
  }
  return fallback ?? OUTPUT_CONTENT_TYPE
}

async function normalizeIconBuffer(entry: MultipartEntry): Promise<{ buffer: Buffer, extension: string, contentType: string }> {
  try {
    const extension = resolveExtension(entry)
    const lowerExt = extension.toLowerCase()
    const type = entry.type?.toLowerCase() ?? ''

    if (lowerExt === '.svg' || type === 'image/svg+xml') {
      return { buffer: entry.data, extension: '.svg', contentType: 'image/svg+xml' }
    }
    if (lowerExt === '.ico' || type === 'image/x-icon' || type === 'image/vnd.microsoft.icon') {
      return { buffer: entry.data, extension: '.ico', contentType: 'image/x-icon' }
    }

    const normalizedBuffer = await sharp(entry.data)
      .rotate()
      .resize(256, 256, { fit: 'inside', withoutEnlargement: true })
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toBuffer()

    return { buffer: normalizedBuffer, extension: '.png', contentType: OUTPUT_CONTENT_TYPE }
  }
  catch (error) {
    console.warn('Icon normalization failed:', error)
    throw createError({ statusCode: 400, statusMessage: '图标处理失败，请确认文件为有效的图片。' })
  }
}

export default defineEventHandler(async (event: H3Event): Promise<SiteSettings> => {
  await requireAdmin(event)
  const form = await readMultipartFormData(event)
  const iconFile = pickIconFile(form as MultipartEntry[] | null | undefined)
  assertIconSize(iconFile)
  assertIconType(iconFile)

  const { buffer, extension, contentType } = await normalizeIconBuffer(iconFile)
  const storageConfig = requireS3Config(useRuntimeConfig(event).storage)
  const key = buildKey(extension)
  const iconUrl = await uploadBufferToS3({
    key,
    data: buffer,
    contentType: resolveContentType(extension, contentType),
    config: storageConfig,
  })

  return updateSiteIcon(iconUrl)
})
