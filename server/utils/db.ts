import { join } from 'node:path'
import { createClient, type Client } from '@libsql/client'
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql'
import * as schema from '../database/schema'
import 'dotenv/config'

type Database = LibSQLDatabase<typeof schema>

const globalForDb = globalThis as unknown as {
  drizzleDb?: Database
  drizzleClient?: Client
}

function resolveDatabaseUrl(): string {
  const rawUrl = process.env.DATABASE_URL ?? `file:${join(process.cwd(), 'storage', 'data.db')}`
  if (rawUrl.startsWith('file:./')) {
    const relativePath = rawUrl.replace('file:', '')
    return `file:${join(process.cwd(), relativePath)}`
  }
  return rawUrl
}

function createDrizzle(): Database {
  const url = resolveDatabaseUrl()
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.log(`[drizzle] using database url: ${url}`)
  }
  const client = createClient({
    url,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  })
  const db = drizzle(client, { schema })
  globalForDb.drizzleClient = client
  return db
}

export const db: Database = globalForDb.drizzleDb ?? createDrizzle()

if (process.env.NODE_ENV !== 'production') {
  globalForDb.drizzleDb = db
}

export async function closeDb(): Promise<void> {
  if (globalForDb.drizzleClient) {
    await globalForDb.drizzleClient.close()
    if (process.env.NODE_ENV !== 'production') {
      globalForDb.drizzleClient = undefined
    }
  }
}

export * from '../database/schema'
