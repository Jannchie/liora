import { sql } from 'drizzle-orm'
import { db } from './db'

interface EnsureState {
  promise?: Promise<void>
}

const globalState = globalThis as typeof globalThis & {
  __lioraSeriesSchema?: EnsureState
}

const ensureState = globalState.__lioraSeriesSchema ?? (globalState.__lioraSeriesSchema = {})

async function ensureSeriesSchemaInternal(): Promise<void> {
  await db.run(sql.raw(`
    CREATE TABLE IF NOT EXISTS "Series" (
      "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      "slug" text NOT NULL,
      "title" text NOT NULL,
      "description" text DEFAULT '' NOT NULL,
      "coverFileId" integer,
      "createdAt" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      "updatedAt" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY ("coverFileId") REFERENCES "File"("id") ON UPDATE no action ON DELETE set null
    );
  `))
  await db.run(sql.raw('CREATE UNIQUE INDEX IF NOT EXISTS "Series_slug_unique" ON "Series" ("slug");'))
  await db.run(sql.raw(`
    CREATE TABLE IF NOT EXISTS "SeriesFile" (
      "seriesId" integer NOT NULL,
      "fileId" integer NOT NULL,
      "sortOrder" integer DEFAULT 0 NOT NULL,
      "createdAt" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      PRIMARY KEY("seriesId", "fileId"),
      FOREIGN KEY ("seriesId") REFERENCES "Series"("id") ON UPDATE no action ON DELETE cascade,
      FOREIGN KEY ("fileId") REFERENCES "File"("id") ON UPDATE no action ON DELETE cascade
    );
  `))
  await db.run(sql.raw('CREATE INDEX IF NOT EXISTS "SeriesFile_series_sort_idx" ON "SeriesFile" ("seriesId","sortOrder");'))
  await db.run(sql.raw('CREATE INDEX IF NOT EXISTS "SeriesFile_file_idx" ON "SeriesFile" ("fileId");'))
}

export async function ensureSeriesSchema(): Promise<void> {
  if (ensureState.promise) {
    return ensureState.promise
  }
  ensureState.promise = ensureSeriesSchemaInternal().catch((error) => {
    ensureState.promise = undefined
    throw error
  })
  return ensureState.promise
}
