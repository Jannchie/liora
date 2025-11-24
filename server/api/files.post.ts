import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import type { H3Event } from 'h3';
import sharp from 'sharp';
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
    .resize({
      width: THUMBNAIL_MAX_SIZE,
      height: THUMBNAIL_MAX_SIZE,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 82 })
    .toBuffer();

const saveFileWithThumbnail = async (
  file: MultipartEntry,
  config: S3Config
): Promise<{ imageUrl: string; thumbnailUrl: string }> => {
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
  try {
    const buffer = await createThumbnail(file.data);
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

  return { imageUrl, thumbnailUrl };
};

export default defineEventHandler(async (event): Promise<FileResponse> => {
  const { file, fields } = await parseMultipart(event);
  const storageConfig = requireS3Config(useRuntimeConfig(event).storage);
  const kind = ensureKind(fields.kind);
  const { width, height } = parseNumbers(fields);

  const characters = parseCharacters(fields.characters);
  const metadata = buildMetadata(fields, characters);
  const { imageUrl, thumbnailUrl } = await saveFileWithThumbnail(file, storageConfig);

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
