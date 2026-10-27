import type { Locale, StyleContext } from '@mapette/core'
import type { FeatureCollection, Point } from 'geojson'
import type { PhotoLocation } from '~/types/file'
import { clusterLayers, clusterSource, createBasemap, focusPointLayer, pointLayer, UNCLUSTERED } from '@mapette/core'

/** Geotagged photos (clustered) and the selected photo's highlight. */
export const PHOTO_SOURCE = 'photos'
export const FOCUS_SOURCE = 'focus'

/** Sources that survive a theme / locale restyle instead of being re-parsed. */
export const PHOTO_MAP_KEEP_SOURCES = [PHOTO_SOURCE, FOCUS_SOURCE]

/** Above this zoom every photo is its own point. */
const CLUSTER = { radius: 64, maxZoom: 14 }

const EMPTY: FeatureCollection<Point> = { type: 'FeatureCollection', features: [] }

export function photoMapStyle({ palette, locale }: StyleContext) {
  return createBasemap({
    palette,
    locale,
    sources: {
      // Data arrives later through setData, so the style never re-parses it.
      [PHOTO_SOURCE]: clusterSource(EMPTY, CLUSTER),
      [FOCUS_SOURCE]: { type: 'geojson', data: EMPTY },
    },
    overlays: [
      pointLayer({ source: PHOTO_SOURCE, palette, fade: false, filter: UNCLUSTERED }),
      ...clusterLayers({ source: PHOTO_SOURCE, palette }),
      focusPointLayer({ source: FOCUS_SOURCE, palette }),
    ],
  })
}

export function toPhotoFeatures(points: PhotoLocation[]): FeatureCollection<Point, { id: number }> {
  return {
    type: 'FeatureCollection',
    features: points.map(point => ({
      type: 'Feature',
      id: point.id,
      geometry: { type: 'Point', coordinates: [point.longitude, point.latitude] },
      properties: { id: point.id },
    })),
  }
}

export function toFocusFeatures(point: { latitude: number; longitude: number } | null): FeatureCollection<Point> {
  if (!point) {
    return EMPTY
  }
  return {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', geometry: { type: 'Point', coordinates: [point.longitude, point.latitude] }, properties: {} },
    ],
  }
}

/** The app's i18n codes → mapette's place-name languages. */
export function toMapLocale(locale: string): Locale {
  if (locale === 'ja') {
    return 'ja'
  }
  if (locale.startsWith('zh')) {
    return 'zh-Hans'
  }
  return 'en'
}

/** [west, south, east, north] */
export type MapBounds = [number, number, number, number]

export function isInBounds(
  point: { latitude: number; longitude: number },
  [west, south, east, north]: MapBounds,
): boolean {
  if (point.latitude < south || point.latitude > north) {
    return false
  }
  if (east - west >= 360) {
    return true
  }
  // Shift into [west, west + 360) so views crossing the antimeridian work too.
  const longitude = ((((point.longitude - west) % 360) + 360) % 360) + west
  return longitude <= east
}
