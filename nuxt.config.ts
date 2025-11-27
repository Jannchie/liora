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

const defaultLocale = 'zh-CN'

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
    ai: {
      openaiApiKey: process.env.OPENAI_API_KEY ?? '',
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
        youtube: process.env.NUXT_PUBLIC_SOCIAL_YOUTUBE ?? '',
        bilibili: process.env.NUXT_PUBLIC_SOCIAL_BILIBILI ?? '',
        tiktok: process.env.NUXT_PUBLIC_SOCIAL_TIKTOK ?? '',
        linkedin: process.env.NUXT_PUBLIC_SOCIAL_LINKEDIN ?? '',
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
    '@nuxtjs/i18n',
  ],
  i18n: {
    strategy: 'no_prefix',
    defaultLocale,
    langDir: 'locales',
    locales: [
      { code: 'zh-CN', name: '简体中文', file: 'zh-CN.json' },
      { code: 'en', name: 'English', file: 'en.json' },
      { code: 'ja', name: '日本語', file: 'ja.json' },
    ],
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_redirected',
      redirectOn: 'root',
    },
    vueI18n: './i18n.config.ts',
  },
  site: {
    url: siteUrl,
    name: 'Liora Gallery',
    description: 'A minimal gallery for photography and illustrations.',
    defaultLocale,
    indexable: siteIndexable,
    env: siteEnv,
  },
  sitemap: {
    sitemapName: 'sitemap.xml',
    exclude: ['/admin/**', '/api/**'],
    defaults: {
      changefreq: 'weekly',
    },
  },
  robots: {
    sitemap: siteUrl ? [`${siteUrl}/sitemap.xml`] : [],
    disallow: ['/admin', '/admin/**', '/api/**'],
  },
  ogImage: {
    defaults: {
      component: 'LioraCard',
      width: 1200,
      height: 630,
    },
    fonts: [
      { name: 'Noto Serif SC', weight: 400, path: '/fonts/NotoSerifSC-Regular.ttf' },
      { name: 'Noto Serif SC', weight: 700, path: '/fonts/NotoSerifSC-Bold.ttf' },
      { name: 'Noto Serif JP', weight: 400, path: '/fonts/NotoSerifJP-Regular.ttf' },
      { name: 'Noto Serif JP', weight: 700, path: '/fonts/NotoSerifJP-Bold.ttf' },
    ],
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
