import type { FileResponse } from '~/types/file'

export function resolveFileTitle(file: Pick<FileResponse, 'title' | 'originalName'>, fallback = '未命名'): string {
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
