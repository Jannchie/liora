import { createError, getQuery } from 'h3'
import { geocodePlace } from '~~/server/utils/nominatim'
import { requireAdmin } from '../utils/auth'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const { q, limit } = getQuery(event)
  const query = typeof q === 'string' ? q : ''
  const numericLimit = typeof limit === 'string' ? Number.parseInt(limit, 10) : undefined
  if (!query.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Search query is required.' })
  }

  const results = await geocodePlace(event, query, Number.isFinite(numericLimit) ? numericLimit : undefined)
  return { results }
})
