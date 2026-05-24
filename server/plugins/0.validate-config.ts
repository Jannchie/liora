import { logger } from '../utils/logger'

// Fail fast on misconfiguration. In production a missing admin credential is a
// hard error (the admin panel would be unusable / insecure), so we crash the
// process instead of letting it boot into a broken state. Storage and AI are
// optional features, so their absence is only a warning.

interface AdminConfig {
  username?: string
  password?: string
  sessionSecret?: string
}

interface StorageConfig {
  endpoint?: string
  bucket?: string
  accessKeyId?: string
  secretAccessKey?: string
}

function isBlank(value: string | undefined): boolean {
  return !value || value.toString().trim().length === 0
}

export default defineNitroPlugin(() => {
  const config = useRuntimeConfig() as unknown as {
    admin?: AdminConfig
    storage?: StorageConfig
    ai?: { openaiApiKey?: string }
  }
  const isProduction = process.env.NODE_ENV === 'production'

  const missingRequired: string[] = []
  if (isBlank(config.admin?.username)) {
    missingRequired.push('ADMIN_USERNAME')
  }
  if (isBlank(config.admin?.password)) {
    missingRequired.push('ADMIN_PASSWORD')
  }

  if (missingRequired.length > 0) {
    const message = `Missing required configuration: ${missingRequired.join(', ')}. `
      + 'Set these environment variables before starting the server.'
    if (isProduction) {
      logger.error('configuration validation failed', { missing: missingRequired })
      throw new Error(message)
    }
    logger.warn('configuration incomplete (allowed in non-production)', { missing: missingRequired })
  }

  if (isBlank(config.admin?.sessionSecret)) {
    logger.warn('ADMIN_SESSION_SECRET is not set; falling back to ADMIN_PASSWORD for session signing. '
      + 'Set a dedicated secret so changing the password does not invalidate the secret derivation.')
  }

  const storageEnvNames: Record<keyof StorageConfig, string> = {
    endpoint: 'S3_ENDPOINT',
    bucket: 'S3_BUCKET',
    accessKeyId: 'S3_ACCESS_KEY_ID',
    secretAccessKey: 'S3_SECRET_ACCESS_KEY',
  }
  const storageMissing = (Object.keys(storageEnvNames) as (keyof StorageConfig)[]).filter(
    key => isBlank(config.storage?.[key]),
  )
  if (storageMissing.length > 0) {
    logger.warn('S3-compatible storage is not fully configured; uploads will be unavailable', {
      missing: storageMissing.map(key => storageEnvNames[key]),
    })
  }

  if (isBlank(config.ai?.openaiApiKey)) {
    logger.info('OPENAI_API_KEY is not set; AI genre classification will be unavailable')
  }

  logger.info('configuration validated', {
    storageConfigured: storageMissing.length === 0,
    aiConfigured: !isBlank(config.ai?.openaiApiKey),
  })
})
