import { createError, getQuery } from 'h3'
import { reverseGeocodePlace } from '~~/server/utils/nominatim'
import { requireAdmin } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const { lat, lon, latitude, longitude } = getQuery(event)
  let rawLat = ''
  let rawLon = ''

  if (typeof lat === 'string') {
    rawLat = lat
  }
  else if (typeof latitude === 'string') {
    rawLat = latitude
  }

  if (typeof lon === 'string') {
    rawLon = lon
  }
  else if (typeof longitude === 'string') {
    rawLon = longitude
  }

  const parsedLat = Number.parseFloat(rawLat)
  const parsedLon = Number.parseFloat(rawLon)

  if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLon)) {
    throw createError({ statusCode: 400, statusMessage: 'Latitude and longitude are required.' })
  }

  const results = await reverseGeocodePlace(event, parsedLat, parsedLon)
  return { results }
})
