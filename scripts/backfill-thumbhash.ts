import { join } from 'node:path';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { PrismaClient } from '../app/generated/prisma/client';
import sharp from 'sharp';
import { rgbaToThumbHash } from 'thumbhash';

type DbFile = {
  id: number;
  imageUrl: string;
  thumbnailUrl: string | null;
  metadata: string;
  title: string;
};

const databaseUrl = process.env.DATABASE_URL ?? `file:${join(process.cwd(), 'prisma', 'dev.db')}`;
const adapter = new PrismaLibSql({ url: databaseUrl });
const prisma = new PrismaClient({ adapter });

const parseMetadata = (raw: string): Record<string, unknown> => {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
};

const fetchImage = async (url: string): Promise<Buffer | null> => {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Skip ${url}: HTTP ${response.status}`);
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.warn(`Skip ${url}: ${String(error)}`);
    return null;
  }
};

const buildThumbhash = async (buffer: Buffer): Promise<string | null> => {
  try {
    const pipeline = sharp(buffer).rotate();
    const metadata = await pipeline.metadata();
    const targetWidth = Math.min(100, metadata.width ?? 100);
    const targetHeight = Math.min(100, metadata.height ?? 100);

    const { data, info } = await pipeline
      .resize(targetWidth, targetHeight, { fit: 'inside', withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const hash = rgbaToThumbHash(info.width, info.height, new Uint8Array(data));
    return Buffer.from(hash).toString('base64');
  } catch (error) {
    console.warn('Failed to build thumbhash:', error);
    return null;
  }
};

const updateFileThumbhash = async (file: DbFile): Promise<boolean> => {
  const metadata = parseMetadata(file.metadata);
  if (typeof metadata.thumbhash === 'string' && metadata.thumbhash.trim().length > 0) {
    return false;
  }

  const sourceUrl = (file.thumbnailUrl?.trim() || file.imageUrl || '').trim();
  if (!sourceUrl) {
    console.warn(`File #${file.id} has no usable image URL`);
    return false;
  }

  const imageBuffer = await fetchImage(sourceUrl);
  if (!imageBuffer) {
    return false;
  }

  const thumbhash = await buildThumbhash(imageBuffer);
  if (!thumbhash) {
    return false;
  }

  metadata.thumbhash = thumbhash;

  await prisma.file.update({
    where: { id: file.id },
    data: { metadata: JSON.stringify(metadata) },
  });

  console.log(`Updated #${file.id} (${file.title || 'untitled'})`);
  return true;
};

const main = async (): Promise<void> => {
  const files = await prisma.file.findMany({ orderBy: { id: 'asc' } });
  let updatedCount = 0;

  for (const file of files) {
    const changed = await updateFileThumbhash(file);
    if (changed) {
      updatedCount += 1;
    }
  }

  console.log(`Backfill complete. Added thumbhash for ${updatedCount} of ${files.length} records.`);
};

void main()
  .catch((error) => {
    console.error('Backfill failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
