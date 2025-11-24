import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createError } from 'h3';

export type S3Config = {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl?: string;
};

type UploadParams = {
  key: string;
  data: Buffer;
  contentType?: string;
  config: S3Config;
};

let cachedClient: S3Client | undefined;
let cachedSignature: string | undefined;

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const buildSignature = (config: S3Config): string =>
  JSON.stringify({
    endpoint: config.endpoint,
    bucket: config.bucket,
    accessKeyId: config.accessKeyId,
  });

const createClient = (config: S3Config): S3Client =>
  new S3Client({
    region: 'auto',
    endpoint: config.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

const getClient = (config: S3Config): S3Client => {
  const signature = buildSignature(config);
  if (!cachedClient || cachedSignature !== signature) {
    cachedClient = createClient(config);
    cachedSignature = signature;
  }
  return cachedClient;
};

export const requireS3Config = (rawConfig: Partial<S3Config>): S3Config => {
  const endpoint = rawConfig.endpoint?.trim();
  const bucket = rawConfig.bucket?.trim();
  const accessKeyId = rawConfig.accessKeyId?.trim();
  const secretAccessKey = rawConfig.secretAccessKey?.trim();
  const publicBaseUrl = rawConfig.publicBaseUrl?.trim();

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'S3-compatible storage is not configured.',
    });
  }

  return {
    endpoint: trimTrailingSlash(endpoint),
    bucket,
    accessKeyId,
    secretAccessKey,
    publicBaseUrl: publicBaseUrl ? trimTrailingSlash(publicBaseUrl) : undefined,
  };
};

export const uploadBufferToS3 = async ({ key, data, contentType, config }: UploadParams): Promise<string> => {
  const client = getClient(config);

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: data,
      ContentType: contentType,
    })
  );

  const baseUrl = config.publicBaseUrl ?? `${config.endpoint}/${config.bucket}`;
  return `${baseUrl}/${key}`;
};
