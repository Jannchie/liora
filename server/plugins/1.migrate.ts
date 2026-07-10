import { join } from 'node:path'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { db } from '../utils/db'
import { logger } from '../utils/logger'

// Apply pending Drizzle migrations on boot so the production image does not
// need drizzle-kit (or node_modules at all). Opt-in via DB_AUTO_MIGRATE=1 —
// local dev keeps using `pnpm run db:migrate` explicitly.

export default defineNitroPlugin(async () => {
  if (process.env.DB_AUTO_MIGRATE !== '1') {
    return
  }

  const migrationsFolder = process.env.DB_MIGRATIONS_DIR ?? join(process.cwd(), 'drizzle')
  try {
    await migrate(db, { migrationsFolder })
    logger.info('database migrations applied', { migrationsFolder })
  }
  catch (error) {
    logger.error('database migration failed; refusing to start', { migrationsFolder })
    throw error
  }
})
