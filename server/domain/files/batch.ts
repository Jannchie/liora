import type {
  BatchMetadataField,
  BatchMetadataPayload,
  BatchSeriesPayload,
  BatchUploadItemPayload,
  BatchUploadPayload,
  FilePayload,
} from '~/types/file'
import { createError } from 'h3'

const BATCH_METADATA_FIELDS = [
  'title',
  'description',
  'genre',
  'width',
  'height',
  'fanworkTitle',
  'characters',
  'location',
  'locationName',
  'latitude',
  'longitude',
  'cameraModel',
  'lensModel',
  'aperture',
  'focalLength',
  'iso',
  'shutterSpeed',
  'exposureBias',
  'exposureProgram',
  'exposureMode',
  'meteringMode',
  'whiteBalance',
  'flash',
  'colorSpace',
  'resolutionX',
  'resolutionY',
  'resolutionUnit',
  'software',
  'captureTime',
  'notes',
] as const

const BATCH_FIELD_SET = new Set<string>(BATCH_METADATA_FIELDS)

function hasOwn(target: object, key: string): boolean {
  return Object.hasOwn(target, key)
}

function parsePositiveInt(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value > 0 ? value : null
  }
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10)
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null
  }
  return null
}

export function parseBatchFileIds(raw: unknown, fieldName = 'fileIds'): number[] {
  if (!Array.isArray(raw)) {
    throw createError({ statusCode: 400, statusMessage: `${fieldName} must be an array.` })
  }
  const normalized = raw
    .map(value => parsePositiveInt(value))
    .filter((value): value is number => value !== null)
  const unique = [...new Set(normalized)]
  if (unique.length === 0) {
    throw createError({ statusCode: 400, statusMessage: `${fieldName} must contain at least one valid id.` })
  }
  if (unique.length !== raw.length) {
    throw createError({ statusCode: 400, statusMessage: `${fieldName} must contain unique positive ids.` })
  }
  return unique
}

export function parseBatchFieldMask(raw: unknown): BatchMetadataField[] {
  if (!Array.isArray(raw)) {
    throw createError({ statusCode: 400, statusMessage: 'fieldMask must be an array.' })
  }
  const normalized = raw
    .map((value) => {
      if (typeof value !== 'string') {
        return null
      }
      const trimmed = value.trim()
      return BATCH_FIELD_SET.has(trimmed) ? (trimmed as BatchMetadataField) : null
    })
    .filter((value): value is BatchMetadataField => value !== null)
  const unique = [...new Set(normalized)]
  if (unique.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'fieldMask must contain at least one valid field.' })
  }
  if (unique.length !== raw.length) {
    throw createError({ statusCode: 400, statusMessage: 'fieldMask must contain unique supported fields.' })
  }
  return unique
}

function assertObjectPayload(raw: unknown, fieldName: string): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw createError({ statusCode: 400, statusMessage: `${fieldName} must be an object.` })
  }
  return raw as Record<string, unknown>
}

export function parseBatchMetadataPayload(raw: BatchMetadataPayload | undefined): {
  fileIds: number[]
  fieldMask: BatchMetadataField[]
  changes: BatchMetadataPayload['changes']
} {
  if (!raw || typeof raw !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Request body is required.' })
  }
  const fileIds = parseBatchFileIds((raw as { fileIds?: unknown }).fileIds)
  const fieldMask = parseBatchFieldMask((raw as { fieldMask?: unknown }).fieldMask)
  const changesRaw = assertObjectPayload((raw as { changes?: unknown }).changes, 'changes')
  for (const field of fieldMask) {
    if (!hasOwn(changesRaw, field)) {
      throw createError({ statusCode: 400, statusMessage: `changes.${field} is required when fieldMask contains ${field}.` })
    }
  }
  return {
    fileIds,
    fieldMask,
    changes: changesRaw as BatchMetadataPayload['changes'],
  }
}

export function pickMaskedChanges(
  changes: BatchMetadataPayload['changes'],
  fieldMask: BatchMetadataField[],
): Partial<FilePayload> & { title?: string, description?: string, genre?: string } {
  const picked: Partial<FilePayload> & { title?: string, description?: string, genre?: string } = {}
  const mutablePicked = picked as Record<string, unknown>
  for (const field of fieldMask) {
    const value = changes[field]
    if (value === undefined) {
      continue
    }
    mutablePicked[field] = value
  }
  return picked
}

export function parseBatchSeriesPayload(raw: BatchSeriesPayload | undefined): {
  fileIds: number[]
  seriesId: number
  action: 'add'
} {
  if (!raw || typeof raw !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Request body is required.' })
  }
  const fileIds = parseBatchFileIds((raw as { fileIds?: unknown }).fileIds)
  const seriesId = parsePositiveInt((raw as { seriesId?: unknown }).seriesId)
  if (!seriesId) {
    throw createError({ statusCode: 400, statusMessage: 'seriesId must be a positive integer.' })
  }
  const action = (raw as { action?: unknown }).action
  if (action !== 'add') {
    throw createError({ statusCode: 400, statusMessage: 'action must be add.' })
  }
  return {
    fileIds,
    seriesId,
    action,
  }
}

function parseBatchUploadItem(raw: unknown, index: number): BatchUploadItemPayload {
  const item = assertObjectPayload(raw, `items[${index}]`)
  const imageKey = typeof item.imageKey === 'string' ? item.imageKey.trim() : ''
  if (!imageKey) {
    throw createError({ statusCode: 400, statusMessage: `items[${index}].imageKey is required.` })
  }
  if (imageKey.includes('..') || imageKey.includes('\\') || imageKey.startsWith('/')) {
    throw createError({ statusCode: 400, statusMessage: `items[${index}].imageKey is invalid.` })
  }
  const imageContentType = typeof item.imageContentType === 'string' && item.imageContentType.trim().length > 0
    ? item.imageContentType.trim()
    : undefined
  const originalName = typeof item.originalName === 'string' && item.originalName.trim().length > 0
    ? item.originalName.trim()
    : undefined
  let metadataOverrides: BatchUploadItemPayload['metadataOverrides']
  if (item.metadataOverrides !== undefined) {
    metadataOverrides = assertObjectPayload(item.metadataOverrides, `items[${index}].metadataOverrides`) as BatchUploadItemPayload['metadataOverrides']
  }
  return {
    imageKey,
    imageContentType,
    originalName,
    metadataOverrides,
  }
}

export function parseBatchUploadPayload(raw: BatchUploadPayload | undefined): {
  items: BatchUploadItemPayload[]
  fieldMask: BatchMetadataField[]
  sharedChanges: BatchUploadPayload['sharedChanges']
} {
  if (!raw || typeof raw !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Request body is required.' })
  }
  const fieldMask = parseBatchFieldMask((raw as { fieldMask?: unknown }).fieldMask)
  const sharedChanges = assertObjectPayload((raw as { sharedChanges?: unknown }).sharedChanges, 'sharedChanges') as BatchUploadPayload['sharedChanges']
  for (const field of fieldMask) {
    if (!hasOwn(sharedChanges, field)) {
      throw createError({ statusCode: 400, statusMessage: `sharedChanges.${field} is required when fieldMask contains ${field}.` })
    }
  }
  const rawItems = (raw as { items?: unknown }).items
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'items must contain at least one upload target.' })
  }
  const items = rawItems.map((item, index) => parseBatchUploadItem(item, index))
  return {
    items,
    fieldMask,
    sharedChanges,
  }
}
