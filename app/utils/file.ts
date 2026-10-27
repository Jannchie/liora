import type { FileResponse } from '~/types/file'

export function resolveFileTitle(file: Pick<FileResponse, 'title' | 'originalName'>, fallback = 'Untitled'): string {
  const normalizedTitle = file.title.trim()
  if (normalizedTitle.length > 0) {
    return normalizedTitle
  }
  const normalizedOriginal = file.originalName.trim()
  if (normalizedOriginal.length > 0) {
    return normalizedOriginal
  }
  return fallback
}

const CONTENT_TYPES_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
  mov: 'video/quicktime',
  mp4: 'video/mp4',
}

/** `IMG_0001.HEIC` → `IMG_0001`. */
export function stripExtension(name: string): string {
  return name.replace(/\.[^/.]+$/, '')
}

/**
 * The file's MIME type, falling back to its extension: HEIC and MOV picked
 * on phones or from Windows often arrive with an empty `type`.
 */
export function resolveContentType(file: File, fallback = ''): string {
  if (file.type) {
    return file.type
  }
  const extension = /\.([^/.]+)$/.exec(file.name)?.[1]?.toLowerCase() ?? ''
  return CONTENT_TYPES_BY_EXTENSION[extension] ?? fallback
}

export function isImageFile(file: File): boolean {
  return resolveContentType(file).startsWith('image/')
}

export function isVideoFile(file: File): boolean {
  return resolveContentType(file).startsWith('video/')
}
