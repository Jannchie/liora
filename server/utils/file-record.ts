import type { H3Event } from 'h3'
import type { FileRow } from './db'
import { eq } from 'drizzle-orm'
import { createError } from 'h3'
import { db, files } from './db'
import { requirePositiveIntRouterParam } from './route-params'

export async function findFileById(id: number): Promise<FileRow | undefined> {
  return db.query.files.findFirst({
    where: eq(files.id, id),
  })
}

export async function requireFileById(id: number): Promise<FileRow> {
  const file = await findFileById(id)
  if (!file) {
    throw createError({ statusCode: 404, statusMessage: 'File not found.' })
  }
  return file
}

export async function requireFileFromRouterParam(event: H3Event, key: string, invalidMessage: string): Promise<FileRow> {
  const id = requirePositiveIntRouterParam(event, key, invalidMessage)
  return requireFileById(id)
}
