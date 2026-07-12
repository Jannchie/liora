import type { FileMetadata, FileResponse } from '~/types/file'
import { eq } from 'drizzle-orm'
import { createError, readBody } from 'h3'
import { computeFramedDims, isIdentityRecompose, validateRecomposeParams } from '../../../../shared/utils/recompose'
import { requireAdmin } from '../../../utils/auth'
import { db, files } from '../../../utils/db'
import { buildMetadataFallbacks, ensureMetadata, mapCharacters, toFileResponse } from '../../../utils/file-mapper'
import { requireFileById } from '../../../utils/file-record'
import { requirePositiveIntRouterParam } from '../../../utils/route-params'

interface RecomposeBody {
  recompose?: unknown
}

export default defineEventHandler(async (event): Promise<FileResponse> => {
  requireAdmin(event)
  const id = requirePositiveIntRouterParam(event, 'id', 'Invalid file id.')
  const body = await readBody<RecomposeBody>(event)
  const existing = await requireFileById(id)

  const characters = mapCharacters(existing.characterList)
  const existingMetadata = ensureMetadata(existing.metadata, buildMetadataFallbacks(existing, characters))
  const originalDims = existingMetadata.recompose?.original ?? { width: existing.width, height: existing.height }

  let mergedMetadata: FileMetadata
  let width: number
  let height: number

  if (body.recompose === null || body.recompose === undefined) {
    mergedMetadata = { ...existingMetadata, recompose: undefined }
    width = originalDims.width
    height = originalDims.height
  }
  else {
    const params = validateRecomposeParams(body.recompose)
    if (!params) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid recompose parameters.' })
    }
    // The original-dims snapshot is only ever seeded server-side; never trust the client copy.
    params.original = originalDims
    if (isIdentityRecompose(params)) {
      mergedMetadata = { ...existingMetadata, recompose: undefined }
      width = originalDims.width
      height = originalDims.height
    }
    else {
      const framed = computeFramedDims(params)
      mergedMetadata = { ...existingMetadata, recompose: params }
      width = framed.width
      height = framed.height
    }
  }

  const [updated] = await db
    .update(files)
    .set({
      width,
      height,
      metadata: JSON.stringify(mergedMetadata),
    })
    .where(eq(files.id, id))
    .returning()

  if (!updated) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to update file.' })
  }

  return toFileResponse(updated)
})
