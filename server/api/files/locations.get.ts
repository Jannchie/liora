import type { PhotoLocation } from '~/types/file'
import { and, desc, isNotNull } from 'drizzle-orm'
import { db, files } from '../../utils/db'
import { handleJsonEtag } from '../../utils/http-cache'

// The free-form location is often just the raw "lat, lng" pair.
const coordinatePattern = /^-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/

function resolvePlace(locationName: string, location: string): string {
  const name = locationName.trim()
  if (name) {
    return name
  }
  const label = location.trim()
  return coordinatePattern.test(label) ? '' : label
}

// Every geotagged photo in one payload: the map clusters them client-side, so
// it needs all points up front rather than pages.
export default defineEventHandler(async (event): Promise<PhotoLocation[] | null> => {
  const rows = await db
    .select({
      id: files.id,
      latitude: files.latitude,
      longitude: files.longitude,
      imageUrl: files.imageUrl,
      width: files.width,
      height: files.height,
      title: files.title,
      locationName: files.locationName,
      location: files.location,
      captureTime: files.captureTime,
    })
    .from(files)
    .where(and(isNotNull(files.latitude), isNotNull(files.longitude)))
    .orderBy(desc(files.captureTime), desc(files.createdAt), desc(files.id))

  const points: PhotoLocation[] = []
  for (const row of rows) {
    const { latitude, longitude } = row
    if (latitude === null || longitude === null || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      continue
    }
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || (latitude === 0 && longitude === 0)) {
      continue
    }
    points.push({
      id: row.id,
      latitude,
      longitude,
      imageUrl: row.imageUrl,
      width: row.width,
      height: row.height,
      title: row.title.trim(),
      place: resolvePlace(row.locationName, row.location),
      captureTime: row.captureTime,
    })
  }
  if (handleJsonEtag(event, points)) {
    return null
  }
  return points
})
