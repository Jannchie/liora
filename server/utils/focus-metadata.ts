import type { FileMetadata } from '~/types/file'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { extname, join } from 'node:path'
import { exiftool } from 'exiftool-vendored'

type FocusMetadata = Pick<
  FileMetadata,
  | 'focusDistance'
  | 'focusFrameSize'
  | 'focusLocation'
  | 'focusMode'
  | 'focusPosition'
  | 'hasCrop'
  | 'cropLeft'
  | 'cropTop'
  | 'cropRight'
  | 'cropBottom'
  | 'cropAngle'
  | 'perspectiveHorizontal'
  | 'perspectiveVertical'
  | 'perspectiveRotate'
  | 'perspectiveScale'
  | 'perspectiveUpright'
  | 'uprightTransform'
>

function normalizeMetadataText(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const normalized = value.trim()
    return normalized.length > 0 ? normalized : undefined
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : undefined
  }
  if (typeof value === 'bigint' || typeof value === 'boolean') {
    return String(value)
  }
  if (Array.isArray(value)) {
    const normalized = value
      .map(entry => normalizeMetadataText(entry))
      .filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
      .join(' ')
      .trim()
    return normalized.length > 0 ? normalized : undefined
  }
  if (value && typeof value === 'object' && typeof (value as { toString?: unknown }).toString === 'function') {
    const normalized = String(value).trim()
    return normalized.length > 0 ? normalized : undefined
  }
  return undefined
}

function pickFirstTagValue(tags: Record<string, unknown>, tagNames: string[]): string | undefined {
  for (const tagName of tagNames) {
    const value = normalizeMetadataText(tags[tagName])
    if (value) {
      return value
    }
  }
  return undefined
}

function resolveUprightTransformIndex(raw: string | undefined): number | null {
  if (!raw) {
    return null
  }
  const normalized = raw.trim().toLowerCase()
  if (normalized.length === 0) {
    return null
  }
  const numeric = Number(normalized)
  if (Number.isInteger(numeric) && numeric >= 0 && numeric <= 5) {
    return numeric
  }
  const map: Record<string, number> = {
    off: 0,
    auto: 1,
    level: 2,
    vertical: 3,
    full: 4,
    guided: 5,
  }
  return map[normalized] ?? null
}

function resolveUprightTransform(tags: Record<string, unknown>, perspectiveUpright: string | undefined): string | undefined {
  const resolvedIndex = resolveUprightTransformIndex(perspectiveUpright)
  if (resolvedIndex !== null) {
    return pickFirstTagValue(tags, [`UprightTransform_${resolvedIndex}`])
  }
  return pickFirstTagValue(tags, [
    'UprightTransform_1',
    'UprightTransform_0',
    'UprightTransform_2',
    'UprightTransform_3',
    'UprightTransform_4',
    'UprightTransform_5',
  ])
}

function resolveTempExtension(filename: string | undefined): string {
  const extension = extname(filename ?? '').toLowerCase()
  if (!extension || extension.length > 10 || /[^a-z0-9.]/.test(extension)) {
    return '.img'
  }
  return extension
}

export async function extractFocusMetadataFromBuffer(buffer: Buffer, filename: string | undefined): Promise<FocusMetadata> {
  const workspace = await mkdtemp(join(tmpdir(), 'liora-focus-'))
  const sourcePath = join(workspace, `source${resolveTempExtension(filename)}`)
  try {
    await writeFile(sourcePath, buffer)
    const tags = (await exiftool.read(sourcePath)) as Record<string, unknown>
    const perspectiveUpright = pickFirstTagValue(tags, ['PerspectiveUpright'])
    return {
      focusDistance: pickFirstTagValue(tags, ['FocusDistance2', 'FocusDistance', 'SubjectDistance']),
      focusFrameSize: pickFirstTagValue(tags, ['FocusFrameSize']),
      focusLocation: pickFirstTagValue(tags, ['FocusLocation']),
      focusMode: pickFirstTagValue(tags, ['FocusMode']),
      focusPosition: pickFirstTagValue(tags, ['FocusPosition2', 'FocusPosition']),
      hasCrop: pickFirstTagValue(tags, ['HasCrop']),
      cropLeft: pickFirstTagValue(tags, ['CropLeft']),
      cropTop: pickFirstTagValue(tags, ['CropTop']),
      cropRight: pickFirstTagValue(tags, ['CropRight']),
      cropBottom: pickFirstTagValue(tags, ['CropBottom']),
      cropAngle: pickFirstTagValue(tags, ['CropAngle']),
      perspectiveHorizontal: pickFirstTagValue(tags, ['PerspectiveHorizontal']),
      perspectiveVertical: pickFirstTagValue(tags, ['PerspectiveVertical']),
      perspectiveRotate: pickFirstTagValue(tags, ['PerspectiveRotate']),
      perspectiveScale: pickFirstTagValue(tags, ['PerspectiveScale']),
      perspectiveUpright,
      uprightTransform: resolveUprightTransform(tags, perspectiveUpright),
    }
  }
  catch (error) {
    console.warn('Focus metadata extraction failed:', error)
    return {}
  }
  finally {
    await rm(workspace, { recursive: true, force: true })
  }
}
