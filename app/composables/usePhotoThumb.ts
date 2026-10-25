/**
 * Resized webp through the image provider, for thumbnails outside the
 * waterfall (map pins, cluster menus, panel lists).
 */
export function usePhotoThumb(): (src: string, width: number) => string {
  const image = useImage()
  return (src, width) => {
    const normalized = src.trim()
    if (!normalized) {
      return ''
    }
    return image(normalized, { width, format: 'webp', fit: 'inside', quality: 75 }) || normalized
  }
}
