function resolveDomains(): string[] {
  const domains = new Set<string>()
  const add = (value: string | undefined): void => {
    if (!value) {
      return
    }
    try {
      const host = new URL(value).host
      if (host) {
        domains.add(host)
      }
    }
    catch {
      // ignore invalid URLs
    }
  }

  add(process.env.S3_PUBLIC_BASE_URL)
  add(process.env.S3_ENDPOINT)
  return [...domains]
}

const resolveSiteEnv = (): string => process.env.NUXT_SITE_ENV ?? process.env.NODE_ENV ?? 'development'

function resolveSiteUrl(siteEnv: string): string | undefined {
  const envUrl = process.env.NUXT_SITE_URL ?? process.env.NUXT_PUBLIC_SITE_URL ?? process.env.SITE_URL
  if (envUrl && envUrl.trim().length > 0) {
    return envUrl
  }
  if (siteEnv === 'development') {
    return 'http://localhost:3000'
  }
  return undefined
}

function resolveIndexable(siteEnv: string, siteUrl?: string): boolean {
  const flag = process.env.NUXT_SITE_INDEXABLE ?? process.env.NUXT_PUBLIC_SITE_INDEXABLE
  if (flag !== undefined) {
    return flag !== 'false'
  }
  return siteEnv === 'production' && Boolean(siteUrl)
}

const siteEnv = resolveSiteEnv()
const siteUrl = resolveSiteUrl(siteEnv)
const siteIndexable = resolveIndexable(siteEnv, siteUrl)

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    admin: {
      username: process.env.ADMIN_USERNAME ?? process.env.NUXT_ADMIN_USERNAME ?? '',
      password: process.env.ADMIN_PASSWORD ?? process.env.NUXT_ADMIN_PASSWORD ?? '',
      sessionSecret: process.env.ADMIN_SESSION_SECRET ?? process.env.NUXT_ADMIN_SESSION_SECRET ?? '',
    },
    storage: {
      endpoint: process.env.S3_ENDPOINT ?? '',
      bucket: process.env.S3_BUCKET ?? '',
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
      publicBaseUrl: process.env.S3_PUBLIC_BASE_URL ?? '',
    },
    public: {
      social: {
        github: process.env.NUXT_PUBLIC_SOCIAL_GITHUB ?? '',
        twitter: process.env.NUXT_PUBLIC_SOCIAL_TWITTER ?? '',
        instagram: process.env.NUXT_PUBLIC_SOCIAL_INSTAGRAM ?? '',
        weibo: process.env.NUXT_PUBLIC_SOCIAL_WEIBO ?? '',
      },
    },
  },
  modules: [
    '@nuxt/eslint',
    '@nuxt/hints',
    '@nuxt/image',
    '@nuxt/icon',
    '@nuxtjs/seo',
    '@nuxt/ui',
    '@nuxt/test-utils',
  ],
  site: {
    url: siteUrl,
    name: 'Liora Gallery',
    description: 'A minimal gallery for photography and illustrations.',
    defaultLocale: 'zh-CN',
    indexable: siteIndexable,
    env: siteEnv,
  },
  image: {
    domains: resolveDomains(),
    format: ['webp', 'avif', 'jpeg'],
  },
  eslint: {
    config: {
      standalone: false,
    },
  },
})
