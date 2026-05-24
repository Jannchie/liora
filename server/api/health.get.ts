import { sql } from 'drizzle-orm'
import { setResponseStatus } from 'h3'
import { db } from '../utils/db'
import { logger } from '../utils/logger'

interface HealthResponse {
  status: 'ok' | 'degraded'
  uptime: number
  db: 'ok' | 'error'
}

// Lightweight health probe for container orchestrators and uptime monitors.
// Returns 200 when the database is reachable, 503 otherwise. Does not require
// authentication so it can be polled by infrastructure.
export default defineEventHandler(async (event): Promise<HealthResponse> => {
  let dbStatus: 'ok' | 'error' = 'ok'
  try {
    await db.run(sql`select 1`)
  }
  catch (error) {
    dbStatus = 'error'
    logger.error('health check: database unreachable', { error })
  }

  const healthy = dbStatus === 'ok'
  if (!healthy) {
    setResponseStatus(event, 503)
  }

  return {
    status: healthy ? 'ok' : 'degraded',
    uptime: Math.round(process.uptime()),
    db: dbStatus,
  }
})
