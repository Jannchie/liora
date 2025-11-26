import type { H3Event } from 'h3'
import { createError } from 'h3'

interface NominatimResult {
  place_id?: number
  display_name?: string
  lat?: string
  lon?: string
  name?: string
}

export interface GeocodeResult {
  id: string
  name: string
  placeName: string
  latitude: number
  longitude: number
}

const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org/search'
const MAX_RESULTS = 10
const USER_AGENT = 'LioraGallery/1.0'
const MIN_INTERVAL_MS = 1000

let lastRequestAt = 0
let pendingChain: Promise<unknown> = Promise.resolve()

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

function enqueueRequest<T>(task: () => Promise<T>): Promise<T> {
  const run = async (): Promise<T> => {
    const now = Date.now()
    const wait = Math.max(0, lastRequestAt + MIN_INTERVAL_MS - now)
    if (wait > 0) {
      await sleep(wait)
    }
    try {
      return await task()
    }
    finally {
      lastRequestAt = Date.now()
    }
  }

  const next = pendingChain.then(run, run)
  pendingChain = next.then(() => null, () => null)
  return next
}

function parseCoordinate(raw: string | undefined): number | null {
  if (!raw) {
    return null
  }
  const numeric = Number.parseFloat(raw)
  return Number.isFinite(numeric) ? numeric : null
}

export async function geocodePlace(event: H3Event, query: string, limit = 5): Promise<GeocodeResult[]> {
  const trimmed = query.trim()
  if (!trimmed) {
    throw createError({ statusCode: 400, statusMessage: 'Search query is required.' })
  }

  const cappedLimit = Math.min(Math.max(limit, 1), MAX_RESULTS)
  const searchParams = new URLSearchParams({
    format: 'jsonv2',
    q: trimmed,
    limit: cappedLimit.toString(),
    addressdetails: '0',
  })

  const results = await enqueueRequest(() => $fetch<NominatimResult[]>(`${NOMINATIM_BASE_URL}?${searchParams.toString()}`, {
    headers: {
      'User-Agent': USER_AGENT,
    },
  }))

  return results
    .map((entry) => {
      const latitude = parseCoordinate(entry.lat)
      const longitude = parseCoordinate(entry.lon)
      if (latitude === null || longitude === null) {
        return null
      }
      const placeName = entry.display_name?.trim() ?? ''
      const name = entry.name?.trim() || placeName
      if (!placeName || !name) {
        return null
      }
      return {
        id: entry.place_id ? String(entry.place_id) : `${latitude},${longitude}`,
        name,
        placeName,
        latitude,
        longitude,
      }
    })
    .filter((entry): entry is GeocodeResult => entry !== null)
}
