import { spawn } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { access, copyFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { extname, join } from 'node:path'
import { Readable } from 'node:stream'
import type { ReadableStream as WebReadableStream } from 'node:stream/web'
import { pipeline } from 'node:stream/promises'
import { exiftool } from 'exiftool-vendored'
import type { WriteTags } from 'exiftool-vendored'
import ffmpegPath from 'ffmpeg-static'
import sharp from 'sharp'

interface TempWorkspace {
  dir: string
  cleanup: () => Promise<void>
}

export interface LivePhotoAsset {
  filePath: string
  fileName: string
  cleanup: () => Promise<void>
}

const jpegQuality = 92
const defaultBaseName = 'live-photo'

function resolveExtension(url: string, fallback: string): string {
  try {
    const resolved = extname(new URL(url).pathname)
    return resolved.length > 0 ? resolved : fallback
  }
  catch {
    return fallback
  }
}

export function resolveBaseName(value: string): string {
  const normalized = value
    .normalize('NFKD')
    .replaceAll(/[^\w-]+/g, '-')
    .replaceAll(/-+/g, '-')
    .replaceAll(/^-|-$/g, '')
    .slice(0, 80)
  return normalized.length > 0 ? normalized : defaultBaseName
}

export async function createTempWorkspace(prefix = 'live-photo-'): Promise<TempWorkspace> {
  const dir = await mkdtemp(join(tmpdir(), prefix))
  const cleanup = async (): Promise<void> => {
    await rm(dir, { recursive: true, force: true })
  }
  return { dir, cleanup }
}

export async function downloadToFile(url: string, targetPath: string): Promise<void> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.status}`)
  }
  if (!response.body) {
    const buffer = Buffer.from(await response.arrayBuffer())
    await new Promise<void>((resolve, reject) => {
      const stream = createWriteStream(targetPath)
      stream.on('error', reject)
      stream.on('finish', resolve)
      stream.end(buffer)
    })
    return
  }
  const readable = Readable.fromWeb(response.body as WebReadableStream<Uint8Array>)
  await pipeline(readable, createWriteStream(targetPath))
}

export async function createLivePhotoImage(
  imageUrl: string,
  contentId: string,
  baseName: string,
): Promise<LivePhotoAsset> {
  const workspace = await createTempWorkspace('live-photo-image-')
  const sourcePath = join(workspace.dir, `source${resolveExtension(imageUrl, '.img')}`)
  const outputPath = join(workspace.dir, `${baseName}.jpg`)
  try {
    await downloadToFile(imageUrl, sourcePath)
    await sharp(sourcePath)
      .jpeg({ quality: jpegQuality })
      .toFile(outputPath)
    await writeLivePhotoImageMetadata(outputPath, contentId)
    return {
      filePath: outputPath,
      fileName: `${baseName}.jpg`,
      cleanup: workspace.cleanup,
    }
  }
  catch (error) {
    await workspace.cleanup()
    throw error
  }
}

export async function createLivePhotoVideo(
  videoUrl: string,
  contentId: string,
  stillTime: number,
  baseName: string,
): Promise<LivePhotoAsset> {
  const workspace = await createTempWorkspace('live-photo-video-')
  const sourcePath = join(workspace.dir, `source${resolveExtension(videoUrl, '.video')}`)
  const outputPath = join(workspace.dir, `${baseName}.mov`)
  try {
    await downloadToFile(videoUrl, sourcePath)
    const sourceExt = extname(sourcePath).toLowerCase()
    await (sourceExt === '.mov'
      ? copyFile(sourcePath, outputPath)
      : rewrapVideoToMov(sourcePath, outputPath))
    await writeLivePhotoVideoMetadata(outputPath, contentId, stillTime)
    return {
      filePath: outputPath,
      fileName: `${baseName}.mov`,
      cleanup: workspace.cleanup,
    }
  }
  catch (error) {
    await workspace.cleanup()
    throw error
  }
}

async function writeLivePhotoImageMetadata(filePath: string, contentId: string): Promise<void> {
  const tags = {
    'XMP:ContentIdentifier': contentId,
    'ContentIdentifier': contentId,
  } as WriteTags
  await exiftool.write(filePath, tags, ['-overwrite_original'])
}

async function writeLivePhotoVideoMetadata(filePath: string, contentId: string, stillTime: number): Promise<void> {
  const safeStillTime = Number.isFinite(stillTime) && stillTime >= 0 ? stillTime : 0
  const tags = {
    'QuickTime:ContentIdentifier': contentId,
    'QuickTime:StillImageTime': safeStillTime,
    'ContentIdentifier': contentId,
  } as WriteTags
  await exiftool.write(filePath, tags, ['-overwrite_original'])
}

async function resolveFfmpegPath(): Promise<string> {
  if (typeof ffmpegPath === 'string' && ffmpegPath.length > 0) {
    try {
      await access(ffmpegPath)
      return ffmpegPath
    }
    catch {
      // Fall back to PATH resolution below.
    }
  }
  return 'ffmpeg'
}

async function rewrapVideoToMov(inputPath: string, outputPath: string): Promise<void> {
  const ffmpeg = await resolveFfmpegPath()
  await runCommand(ffmpeg, [
    '-y',
    '-i',
    inputPath,
    '-c',
    'copy',
    '-map',
    '0',
    '-movflags',
    'use_metadata_tags',
    outputPath,
  ])
}

async function runCommand(command: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'ignore' })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
      }
      else {
        reject(new Error(`Command failed: ${command} ${args.join(' ')}`))
      }
    })
  })
}
