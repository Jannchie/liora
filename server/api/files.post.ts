import { createHash, randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import type { H3Event } from 'h3';
import sharp from 'sharp';
import { rgbaToThumbHash } from 'thumbhash';
import type { FileMetadata, FileResponse } from '~/types/file';
import { prisma } from '../utils/prisma';
import type { S3Config } from '../utils/s3';
import { requireS3Config, uploadBufferToS3 } from '../utils/s3';

type MultipartEntry = {
  name: string;
  filename?: string;
  type?: string;
  data: Buffer;
};

type ParsedForm = {
  file: MultipartEntry;
  fields: Record<string, string>;
};

const THUMBNAIL_MAX_SIZE = 960;
const SIMILARITY_THRESHOLD = 6;

type ImageHashes = {
  perceptualHash: string | null;
  sha256: string;
};

const computePerceptualHash = async (data: Buffer): Promise<string | null> => {
  try {
    const { data: raw } = await sharp(data)
      .rotate()
      .resize(8, 8, { fit: 'cover' })
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixels = new Uint8Array(raw);
    const mean = pixels.reduce((sum, value) => sum + value, 0) / pixels.length;
    let hash = 0n;
    for (const value of pixels) {
      hash = (hash << 1n) | (value > mean ? 1n : 0n);
    }
    return hash.toString(16).padStart(16, '0');
  } catch (error) {
    console.warn('Perceptual hash generation failed:', error);
    return null;
  }
};

const computeHashes = async (data: Buffer): Promise<ImageHashes> => ({
  perceptualHash: await computePerceptualHash(data),
  sha256: createHash('sha256').update(data).digest('hex'),
});

const extractHashes = (raw: string): { perceptualHash?: string; sha256?: string } => {
  try {
    const parsed = JSON.parse(raw) as Partial<FileMetadata>;
    return {
      perceptualHash: typeof parsed.perceptualHash === 'string' ? parsed.perceptualHash : undefined,
      sha256: typeof parsed.sha256 === 'string' ? parsed.sha256 : undefined,
    };
  } catch {
    return {};
  }
};

const hammingDistance = (first: string, second: string): number | null => {
  if (!first || !second || first.length !== second.length) {
    return null;
  }
  let diff = BigInt(`0x${first}`) ^ BigInt(`0x${second}`);
  let distance = 0;
  while (diff !== 0n) {
    distance += Number(diff & 1n);
    diff >>= 1n;
  }
  return distance;
};

const findSimilarFile = async (hashes: ImageHashes): Promise<{ id: number; title: string; distance: number } | null> => {
  const existing = await prisma.file.findMany({ select: { id: true, title: true, metadata: true } });
  let closest: { id: number; title: string; distance: number } | null = null;

  for (const file of existing) {
    const parsed = extractHashes(file.metadata);
    if (parsed.sha256 && parsed.sha256 === hashes.sha256) {
      return { id: file.id, title: file.title, distance: 0 };
    }
    if (!parsed.perceptualHash || !hashes.perceptualHash) {
      continue;
    }
    const distance = hammingDistance(parsed.perceptualHash, hashes.perceptualHash);
    if (distance === null) {
      continue;
    }
    if (distance <= SIMILARITY_THRESHOLD && (!closest || distance < closest.distance)) {
      closest = { id: file.id, title: file.title, distance };
    }
  }

  return closest;
};

const normalizeText = (value: string | undefined): string => value?.trim() ?? '';

const parseCharacters = (raw: string | undefined): string[] =>
  (raw ?? '')
    .split(/[,，\n]/)
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

const buildMetadata = (fields: Record<string, string>, characters: string[]): FileMetadata => ({
  fanworkTitle: normalizeText(fields.fanworkTitle),
  characters,
  location: normalizeText(fields.location),
  locationName: normalizeText(fields.locationName),
  latitude: fields.latitude ? Number(fields.latitude) : null,
  longitude: fields.longitude ? Number(fields.longitude) : null,
  cameraModel: normalizeText(fields.cameraModel),
  aperture: normalizeText(fields.aperture),
  focalLength: normalizeText(fields.focalLength),
  iso: normalizeText(fields.iso),
  shutterSpeed: normalizeText(fields.shutterSpeed),
  captureTime: normalizeText(fields.captureTime),
  notes: normalizeText(fields.notes),
  thumbhash: undefined,
  perceptualHash: undefined,
  sha256: undefined,
});

const ensureKind = (value: string | undefined): 'PAINTING' | 'PHOTOGRAPHY' => {
  if (value === 'PAINTING' || value === 'PHOTOGRAPHY') {
    return value;
  }
  throw createError({ statusCode: 400, statusMessage: 'Invalid file kind.' });
};

const parseNumbers = (fields: Record<string, string>): { width: number; height: number } => {
  const width = Number(fields.width);
  const height = Number(fields.height);

  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Width and height are required.' });
  }

  return { width, height };
};

const parseMultipart = async (event: H3Event): Promise<ParsedForm> => {
  const form = await readMultipartFormData(event);
  if (!form) {
    throw createError({ statusCode: 400, statusMessage: 'Multipart form data is required.' });
  }

  let fileEntry: MultipartEntry | undefined;
  const fields: Record<string, string> = {};

  for (const entry of form) {
    if (entry.filename) {
      if (!fileEntry) {
        fileEntry = entry as MultipartEntry;
      }
    } else {
      fields[entry.name] = entry.data.toString('utf8');
    }
  }

  if (!fileEntry || !fileEntry.data?.length) {
    throw createError({ statusCode: 400, statusMessage: 'Image file is required.' });
  }

  return { file: fileEntry, fields };
};

const normalizeExt = (filename: string | undefined): string => {
  const parsed = extname(filename ?? '').toLowerCase();
  if (parsed) {
    return parsed;
  }
  return '.jpg';
};

const createThumbnail = async (data: Buffer): Promise<Buffer> =>
  sharp(data)
    .rotate()
    .resize({
      width: THUMBNAIL_MAX_SIZE,
      height: THUMBNAIL_MAX_SIZE,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 82 })
    .toBuffer();

const generateThumbhash = async (data: Buffer): Promise<string | null> => {
  try {
    const pipeline = sharp(data).rotate();
    const metadata = await pipeline.metadata();
    const targetWidth = Math.min(100, metadata.width ?? 100);
    const targetHeight = Math.min(100, metadata.height ?? 100);

    const { data: raw, info } = await pipeline
      .resize(targetWidth, targetHeight, { fit: 'inside', withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const hash = rgbaToThumbHash(info.width, info.height, new Uint8Array(raw));
    return Buffer.from(hash).toString('base64');
  } catch (error) {
    console.warn('Thumbhash generation failed:', error);
    return null;
  }
};

const saveFileWithThumbnail = async (
  file: MultipartEntry,
  config: S3Config
): Promise<{ imageUrl: string; thumbnailUrl: string; thumbhash?: string }> => {
  const ext = normalizeExt(file.filename);
  const baseName = `${Date.now()}-${randomUUID()}`;
  const originalKey = `${baseName}${ext}`;
  const thumbnailKey = `${baseName}-thumb.webp`;

  const imageUrl = await uploadBufferToS3({
    key: originalKey,
    data: file.data,
    contentType: file.type,
    config,
  });

  let thumbnailUrl = imageUrl;
  let thumbhash: string | undefined;
  try {
    const buffer = await createThumbnail(file.data);
    const hash = await generateThumbhash(buffer);
    if (hash) {
      thumbhash = hash;
    }
    thumbnailUrl = await uploadBufferToS3({
      key: thumbnailKey,
      data: buffer,
      contentType: 'image/webp',
      config,
    });
  } catch (error) {
    // Fall back to original image if thumbnail generation fails.
    console.warn('Thumbnail generation failed, falling back to original image:', error);
  }

  return { imageUrl, thumbnailUrl, thumbhash };
};

export default defineEventHandler(async (event): Promise<FileResponse> => {
  const { file, fields } = await parseMultipart(event);
  const storageConfig = requireS3Config(useRuntimeConfig(event).storage);
  const kind = ensureKind(fields.kind);
  const { width, height } = parseNumbers(fields);

  const characters = parseCharacters(fields.characters);
  const metadata = buildMetadata(fields, characters);
  const hashes = await computeHashes(file.data);
  metadata.perceptualHash = hashes.perceptualHash ?? undefined;
  metadata.sha256 = hashes.sha256;

  const similar = await findSimilarFile(hashes);
  if (similar) {
    throw createError({
      statusCode: 409,
      statusMessage: `检测到相似图片，已存在记录 #${similar.id}${similar.distance > 0 ? `（距离 ${similar.distance}）` : ''}`,
      data: { existingId: similar.id, distance: similar.distance },
    });
  }
  const { imageUrl, thumbnailUrl, thumbhash } = await saveFileWithThumbnail(file, storageConfig);
  if (thumbhash) {
    metadata.thumbhash = thumbhash;
  }

  const created = await prisma.file.create({
    data: {
      kind,
      title: normalizeText(fields.title),
      description: normalizeText(fields.description),
      imageUrl,
      thumbnailUrl,
      width,
      height,
      fanworkTitle: '',
      characterList: '',
      location: metadata.location,
      locationName: metadata.locationName,
      latitude: metadata.latitude,
      longitude: metadata.longitude,
      cameraModel: metadata.cameraModel,
      aperture: metadata.aperture,
      focalLength: metadata.focalLength,
      iso: metadata.iso,
      shutterSpeed: metadata.shutterSpeed,
      captureTime: metadata.captureTime,
      metadata: JSON.stringify(metadata),
    },
  });

  return {
    id: created.id,
    kind: created.kind,
    title: created.title,
    description: created.description,
    imageUrl: created.imageUrl,
    thumbnailUrl: created.thumbnailUrl,
    width: created.width,
    height: created.height,
    fanworkTitle: created.fanworkTitle,
    location: created.location,
    cameraModel: created.cameraModel,
    characters,
    metadata,
    createdAt: created.createdAt.toISOString(),
  };
});
