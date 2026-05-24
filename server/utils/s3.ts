import type { ReadableStream as WebReadableStream } from 'node:stream/web'
import { createReadStream } from 'node:fs'
import { Readable } from 'node:stream'
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createError } from 'h3'

export interface S3Config {
  endpoint: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  publicBaseUrl?: string
}

interface UploadParams {
  key: string
  data: Buffer
  contentType?: string
  contentDisposition?: string
  cacheControl?: string
  config: S3Config
}

interface UploadFileParams {
  key: string
  filePath: string
  contentType?: string
  contentDisposition?: string
  cacheControl?: string
  config: S3Config
}

interface PresignedPutParams {
  key: string
  contentType?: string
  expiresIn?: number
  config: S3Config
}

let cachedClient: S3Client | undefined
let cachedSignature: string | undefined

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '')

function buildSignature(config: S3Config): string {
  return JSON.stringify({
    endpoint: config.endpoint,
    bucket: config.bucket,
    accessKeyId: config.accessKeyId,
  })
}

function createClient(config: S3Config): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: config.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  })
}

function getClient(config: S3Config): S3Client {
  const signature = buildSignature(config)
  if (!cachedClient || cachedSignature !== signature) {
    cachedClient = createClient(config)
    cachedSignature = signature
  }
  return cachedClient
}

export function buildPublicUrl(config: S3Config, key: string): string {
  const baseUrl = trimTrailingSlash(config.publicBaseUrl ?? `${config.endpoint}/${config.bucket}`)
  return `${baseUrl}/${key}`
}

export function extractKeyFromPublicUrl(config: S3Config, url: string): string | null {
  const baseUrl = trimTrailingSlash(config.publicBaseUrl ?? `${config.endpoint}/${config.bucket}`)
  if (!url.startsWith(`${baseUrl}/`)) {
    return null
  }
  return url.slice(baseUrl.length + 1)
}

export function requireS3Config(rawConfig: Partial<S3Config>): S3Config {
  const endpoint = rawConfig.endpoint?.trim()
  const bucket = rawConfig.bucket?.trim()
  const accessKeyId = rawConfig.accessKeyId?.trim()
  const secretAccessKey = rawConfig.secretAccessKey?.trim()
  const publicBaseUrl = rawConfig.publicBaseUrl?.trim()

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw createError({
      statusCode: 503,
      statusMessage: 'S3-compatible storage is not configured.',
    })
  }

  return {
    endpoint: trimTrailingSlash(endpoint),
    bucket,
    accessKeyId,
    secretAccessKey,
    publicBaseUrl: publicBaseUrl ? trimTrailingSlash(publicBaseUrl) : undefined,
  }
}

export async function uploadBufferToS3({
  key,
  data,
  contentType,
  contentDisposition,
  cacheControl,
  config,
}: UploadParams): Promise<string> {
  const client = getClient(config)

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: data,
      ContentType: contentType,
      ContentDisposition: contentDisposition,
      CacheControl: cacheControl,
    }),
  )

  return buildPublicUrl(config, key)
}

export async function uploadFileToS3({
  key,
  filePath,
  contentType,
  contentDisposition,
  cacheControl,
  config,
}: UploadFileParams): Promise<string> {
  const client = getClient(config)
  const stream = createReadStream(filePath)
  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: stream,
      ContentType: contentType,
      ContentDisposition: contentDisposition,
      CacheControl: cacheControl,
    }),
  )
  return buildPublicUrl(config, key)
}

async function streamToBuffer(stream: unknown): Promise<Buffer> {
  if (stream instanceof Readable) {
    const chunks: Buffer[] = []
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
    return Buffer.concat(chunks)
  }
  if (stream && typeof (stream as Blob).arrayBuffer === 'function') {
    const buffer = await (stream as Blob).arrayBuffer()
    return Buffer.from(buffer)
  }
  if (stream && typeof (stream as WebReadableStream<Uint8Array>).getReader === 'function') {
    const reader = (stream as WebReadableStream<Uint8Array>).getReader()
    const chunks: Uint8Array[] = []
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }
      if (value) {
        chunks.push(value)
      }
    }
    return Buffer.from(chunks.length > 1 ? Buffer.concat(chunks) : (chunks[0] ?? new Uint8Array()))
  }
  throw new Error('Unsupported stream type.')
}

export async function downloadObjectFromS3({
  key,
  config,
}: {
  key: string
  config: S3Config
}): Promise<{ buffer: Buffer, contentType?: string, contentLength?: number }> {
  const client = getClient(config)
  const response = await client.send(
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: key,
    }),
  )
  if (!response.Body) {
    throw createError({ statusCode: 404, statusMessage: 'Object not found.' })
  }
  const buffer = await streamToBuffer(response.Body)
  return {
    buffer,
    contentType: response.ContentType ?? undefined,
    contentLength: typeof response.ContentLength === 'number' ? response.ContentLength : undefined,
  }
}

export async function headObjectFromS3({
  key,
  config,
}: {
  key: string
  config: S3Config
}): Promise<{ contentType?: string, contentLength?: number }> {
  const client = getClient(config)
  const response = await client.send(
    new HeadObjectCommand({
      Bucket: config.bucket,
      Key: key,
    }),
  )
  return {
    contentType: response.ContentType ?? undefined,
    contentLength: typeof response.ContentLength === 'number' ? response.ContentLength : undefined,
  }
}

export async function createPresignedPutUrl({
  key,
  contentType,
  expiresIn = 300,
  config,
}: PresignedPutParams): Promise<{ url: string, headers: Record<string, string> }> {
  const client = getClient(config)
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    ContentType: contentType,
  })
  const url = await getSignedUrl(client, command, { expiresIn })
  const headers: Record<string, string> = {}
  if (contentType) {
    headers['Content-Type'] = contentType
  }
  return { url, headers }
}
