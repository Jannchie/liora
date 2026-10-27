/*
 * Live Photo detection on the client.
 *
 * Two shapes reach the upload page:
 *   - Android "motion photos" (Google, Samsung, Xiaomi, OPPO, vivo…): one
 *     JPEG/HEIC with an MP4 appended after the still. XMP usually says
 *     where it starts (`MicroVideoOffset`, or a `MotionPhoto` container
 *     item); when it doesn't, we scan for the MP4's `ftyp` box.
 *   - Apple Live Photos exported as a still + a same-named MOV
 *     (IMG_1234.HEIC + IMG_1234.MOV). Mobile Safari's photo picker only
 *     hands over the still, so these only pair up when both files are
 *     picked, e.g. from the Files app or a desktop export.
 *
 * Files are read in slices: XMP sits in the first few hundred KB and the
 * MP4 boxes can be walked header by header, so a whole file is only read
 * when the XMP is missing or wrong.
 */
import { isImageFile, isVideoFile, resolveContentType, stripExtension } from '~/utils/file'

export interface MotionPhotoLayout {
  /** Byte offset where the embedded video starts (= end of the still). */
  videoStart: number
  /** Byte offset just past the last top-level MP4 box. */
  videoEnd: number
  videoType: 'video/mp4' | 'video/quicktime'
  /** Cover frame time from XMP, in seconds, when the camera recorded one. */
  presentationTime?: number
}

export interface LivePhotoEntry {
  image: File | null
  video: File | null
  /** Seconds into the video the still was taken at, when known. */
  stillTime?: number
}

const MP4_BRANDS = new Set(['isom', 'iso2', 'iso4', 'iso5', 'iso6', 'mp41', 'mp42', 'avc1', 'qt  ', 'MSNV', 'mp4v', '3gp4', '3gp5', 'hvc1', 'dash'])
const XMP_SCAN_BYTES = 512 * 1024
const BOX_HEADER_BYTES = 16

function readUint32(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset]! << 24) >>> 0) + (bytes[offset + 1]! << 16) + (bytes[offset + 2]! << 8) + bytes[offset + 3]!
}

function readUint64(bytes: Uint8Array, offset: number): number {
  return readUint32(bytes, offset) * 2 ** 32 + readUint32(bytes, offset + 4)
}

function readAscii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + length))
}

/** Box types are four printable ASCII characters. */
function isBoxType(bytes: Uint8Array, offset: number): boolean {
  for (let index = offset; index < offset + 4; index += 1) {
    const byte = bytes[index]
    if (byte === undefined || byte < 0x20 || byte > 0x7E) {
      return false
    }
  }
  return true
}

interface Mp4Box {
  type: string
  start: number
  headerSize: number
  end: number
}

/**
 * Reads the box header at `offset`; `limit` bounds the box. Returns null
 * when the header is malformed or the box overruns the limit.
 */
function readBoxHeader(bytes: Uint8Array, offset: number, limit: number): Mp4Box | null {
  if (offset + 8 > bytes.length || !isBoxType(bytes, offset + 4)) {
    return null
  }
  let size = readUint32(bytes, offset)
  let headerSize = 8
  if (size === 1) {
    if (offset + 16 > bytes.length) {
      return null
    }
    size = readUint64(bytes, offset + 8)
    headerSize = 16
  }
  else if (size === 0) {
    size = limit - offset
  }
  if (size < headerSize || offset + size > limit) {
    return null
  }
  return { type: readAscii(bytes, offset + 4, 4), start: offset, headerSize, end: offset + size }
}

/** Walks sibling boxes in [start, end); stops at the first malformed one. */
function readBoxes(bytes: Uint8Array, start: number, end: number): Mp4Box[] {
  const boxes: Mp4Box[] = []
  let box = readBoxHeader(bytes, start, end)
  while (box) {
    boxes.push(box)
    box = readBoxHeader(bytes, box.end, end)
  }
  return boxes
}

/** Validates an MP4 starting at `start` and returns where it ends. */
function measureMp4(bytes: Uint8Array, start: number): { end: number, type: MotionPhotoLayout['videoType'] } | null {
  const boxes = readBoxes(bytes, start, bytes.length)
  const first = boxes[0]
  if (first?.type !== 'ftyp' || !boxes.some(box => box.type === 'moov')) {
    return null
  }
  const brand = readAscii(bytes, first.start + 8, 4)
  if (!MP4_BRANDS.has(brand)) {
    return null
  }
  return { end: boxes.at(-1)!.end, type: brand === 'qt  ' ? 'video/quicktime' : 'video/mp4' }
}

function readXmp(bytes: Uint8Array): string {
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, XMP_SCAN_BYTES))
  const start = head.indexOf('<x:xmpmeta')
  if (start === -1) {
    return ''
  }
  const end = head.indexOf('</x:xmpmeta>', start)
  return end === -1 ? head.slice(start) : head.slice(start, end)
}

function readXmpNumber(xmp: string, name: string): number | undefined {
  const match = new RegExp(String.raw`${name}(?:="|>)(-?\d+)`).exec(xmp)
  return match ? Number(match[1]) : undefined
}

/** Offsets the XMP claims, most specific first. Each is checked against the bytes. */
function xmpVideoStarts(xmp: string, length: number): number[] {
  const starts: number[] = []
  const microVideoOffset = readXmpNumber(xmp, 'MicroVideoOffset')
  if (microVideoOffset && microVideoOffset > 0) {
    starts.push(length - microVideoOffset)
  }
  // Google's container directory: the motion photo item is the trailing one.
  for (const [item] of xmp.matchAll(/<Container:Item\s[^>]*Item:Semantic="MotionPhoto"[^>]*>/g)) {
    const itemLength = /Item:Length="(\d+)"/.exec(item)
    if (itemLength) {
      const padding = Number(/Item:Padding="(\d+)"/.exec(item)?.[1] ?? 0)
      starts.push(length - Number(itemLength[1]), length - Number(itemLength[1]) - padding)
    }
  }
  return starts.filter(start => start > 0 && start < length)
}

function readPresentationTime(xmp: string): number | undefined {
  const micros = readXmpNumber(xmp, 'MotionPhotoPresentationTimestampUs')
    ?? readXmpNumber(xmp, 'MicroVideoPresentationTimestampUs')
  return micros !== undefined && micros >= 0 ? micros / 1_000_000 : undefined
}

/** Offsets of every `ftyp` box after the first one (a HEIC's own sits at 0). */
function* ftypCandidates(bytes: Uint8Array): Generator<number> {
  // 'f' 't' 'y' 'p'
  let index = bytes.indexOf(0x66, 8)
  while (index !== -1 && index + 8 <= bytes.length) {
    if (bytes[index + 1] === 0x74 && bytes[index + 2] === 0x79 && bytes[index + 3] === 0x70) {
      yield index - 4
    }
    index = bytes.indexOf(0x66, index + 1)
  }
}

/**
 * Finds a video embedded after the still image in a whole file's bytes.
 * Returns null for plain images, including a HEIC whose own `ftyp` sits
 * at offset 0.
 */
export function parseMotionPhoto(bytes: Uint8Array): MotionPhotoLayout | null {
  const xmp = readXmp(bytes)
  const presentationTime = readPresentationTime(xmp)
  for (const starts of [xmpVideoStarts(xmp, bytes.length), ftypCandidates(bytes)]) {
    for (const start of starts) {
      const video = measureMp4(bytes, start)
      if (video) {
        return { videoStart: start, videoEnd: video.end, videoType: video.type, presentationTime }
      }
    }
  }
  return null
}

/** Duration from the MP4/MOV `mvhd` box, in seconds. */
export function readMp4Duration(bytes: Uint8Array, start = 0, end = bytes.length): number | undefined {
  const moov = readBoxes(bytes, start, end).find(box => box.type === 'moov')
  if (!moov) {
    return undefined
  }
  const mvhd = readBoxes(bytes, moov.start + moov.headerSize, moov.end).find(box => box.type === 'mvhd')
  if (!mvhd) {
    return undefined
  }
  const body = mvhd.start + mvhd.headerSize
  const version = bytes[body]
  const timescale = version === 1 ? readUint32(bytes, body + 20) : readUint32(bytes, body + 12)
  const duration = version === 1 ? readUint64(bytes, body + 24) : readUint32(bytes, body + 16)
  return timescale ? duration / timescale : undefined
}

async function readBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer())
}

/** Duration of a standalone video, reading only box headers and `moov`. */
async function readVideoDuration(file: File): Promise<number | undefined> {
  let offset = 0
  while (offset < file.size) {
    const header = await readBytes(file.slice(offset, offset + BOX_HEADER_BYTES))
    const box = readBoxHeader(header, 0, file.size - offset)
    if (!box) {
      return undefined
    }
    if (box.type === 'moov') {
      return readMp4Duration(await readBytes(file.slice(offset, offset + box.end)))
    }
    offset += box.end
  }
  return undefined
}

function mayEmbedVideo(file: File): boolean {
  return /^image\/(?:jpeg|heic|heif)$/.test(resolveContentType(file))
}

/** Finds the embedded video, trusting XMP offsets before scanning the whole file. */
async function locateMotionVideo(file: File): Promise<{ layout: MotionPhotoLayout, duration?: number } | null> {
  const xmp = readXmp(await readBytes(file.slice(0, XMP_SCAN_BYTES)))
  for (const start of xmpVideoStarts(xmp, file.size)) {
    const tail = await readBytes(file.slice(start))
    const video = measureMp4(tail, 0)
    if (video) {
      return {
        layout: { videoStart: start, videoEnd: start + video.end, videoType: video.type, presentationTime: readPresentationTime(xmp) },
        duration: readMp4Duration(tail, 0, video.end),
      }
    }
  }
  const bytes = await readBytes(file)
  const layout = parseMotionPhoto(bytes)
  return layout ? { layout, duration: readMp4Duration(bytes, layout.videoStart, layout.videoEnd) } : null
}

function middleOf(duration: number | null | undefined): number | undefined {
  return duration && duration > 0 ? duration / 2 : undefined
}

/** Splits an Android motion photo into its still and its video, or returns null. */
export async function splitMotionPhoto(file: File): Promise<LivePhotoEntry | null> {
  if (!mayEmbedVideo(file)) {
    return null
  }
  const found = await locateMotionVideo(file)
  if (!found) {
    return null
  }
  const { layout, duration } = found
  const extension = layout.videoType === 'video/quicktime' ? 'mov' : 'mp4'
  const image = new File([file.slice(0, layout.videoStart)], file.name, { type: resolveContentType(file, 'image/jpeg'), lastModified: file.lastModified })
  const video = new File([file.slice(layout.videoStart, layout.videoEnd)], `${stripExtension(file.name) || 'motion-photo'}.${extension}`, { type: layout.videoType, lastModified: file.lastModified })
  return { image, video, stillTime: layout.presentationTime ?? middleOf(duration) }
}

/**
 * Pairs each video with the image of the same base name (case-insensitive).
 * Unpaired images and videos come back as entries of their own, in pick order.
 */
export function pairLivePhotoFiles(files: File[]): LivePhotoEntry[] {
  const pairKey = (file: File): string => stripExtension(file.name).toLowerCase()
  const videos = files.filter(isVideoFile)
  const videosByName = new Map(videos.map(video => [pairKey(video), video]))
  const paired = new Set<File>()
  const entries: LivePhotoEntry[] = []
  for (const file of files) {
    if (isVideoFile(file) || !isImageFile(file)) {
      continue
    }
    const candidate = videosByName.get(pairKey(file))
    const video = candidate && !paired.has(candidate) ? candidate : null
    if (video) {
      paired.add(video)
    }
    entries.push({ image: file, video })
  }
  for (const video of videos) {
    if (!paired.has(video)) {
      entries.push({ image: null, video })
    }
  }
  return entries
}

/**
 * Turns a raw pick into upload entries: splits motion photos, pairs
 * still + video by name, and estimates the cover time for paired videos.
 * Files are handled one at a time to keep peak memory low on phones.
 */
export async function resolveLivePhotoEntries(files: File[]): Promise<LivePhotoEntry[]> {
  const entries: LivePhotoEntry[] = []
  for (const entry of pairLivePhotoFiles(files)) {
    if (entry.image && !entry.video) {
      entries.push(await splitMotionPhoto(entry.image).catch(() => null) ?? entry)
    }
    else if (entry.image && entry.video) {
      const duration = await readVideoDuration(entry.video).catch(() => null)
      entries.push({ ...entry, stillTime: middleOf(duration) })
    }
    else {
      entries.push(entry)
    }
  }
  return entries
}
