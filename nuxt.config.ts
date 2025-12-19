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

const resolveSiteEnv = (): string => process.env.SITE_ENV ?? process.env.NODE_ENV ?? 'development'

function resolveSiteUrl(siteEnv: string): string | undefined {
  const envUrl = process.env.SITE_URL
  if (envUrl && envUrl.trim().length > 0) {
    return envUrl
  }
  if (siteEnv === 'development') {
    return 'http://localhost:3000'
  }
  return undefined
}

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) {
    return defaultValue
  }
  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false
  }
  return defaultValue
}

const siteName = 'Liora Gallery'
const siteDescription = 'A minimal gallery for photography and illustrations.'
const defaultLocale = 'zh-CN'
const pwaBackgroundColorLight = '#d9d9d9'
const pwaBackgroundColorDark = '#0f172a'

const siteEnv = resolveSiteEnv()
const siteUrl = resolveSiteUrl(siteEnv)
const siteIndexable = parseBoolean(process.env.SITE_INDEXABLE, true)

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: {
    enabled: true,

    timeline: {
      enabled: true,
    },
  },
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      meta: [
        {
          key: 'viewport',
          name: 'viewport',
          content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
        },
        {
          key: 'theme-color-light',
          name: 'theme-color',
          content: pwaBackgroundColorLight,
          media: '(prefers-color-scheme: light)',
        },
        {
          key: 'theme-color-dark',
          name: 'theme-color',
          content: pwaBackgroundColorDark,
          media: '(prefers-color-scheme: dark)',
        },
      ],
    },
  },
  runtimeConfig: {
    admin: {
      username: process.env.ADMIN_USERNAME ?? '',
      password: process.env.ADMIN_PASSWORD ?? '',
      sessionSecret: process.env.ADMIN_SESSION_SECRET ?? '',
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
        homepage: process.env.SOCIAL_HOMEPAGE ?? '',
        github: process.env.SOCIAL_GITHUB ?? '',
        twitter: process.env.SOCIAL_TWITTER ?? '',
        instagram: process.env.SOCIAL_INSTAGRAM ?? '',
        weibo: process.env.SOCIAL_WEIBO ?? '',
        youtube: process.env.SOCIAL_YOUTUBE ?? '',
        bilibili: process.env.SOCIAL_BILIBILI ?? '',
        tiktok: process.env.SOCIAL_TIKTOK ?? '',
        linkedin: process.env.SOCIAL_LINKEDIN ?? '',
      },
      imageDomains: [],
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
    '@vite-pwa/nuxt',
    '@sentry/nuxt/module',
  ],
  i18n: {
    strategy: 'no_prefix',
    baseUrl: siteUrl,
    defaultLocale,
    langDir: 'locales',
    locales: [
      { code: 'zh-CN', name: '简体中文', file: 'zh-CN.json', language: 'zh-CN' },
      { code: 'en', name: 'English', file: 'en.json', language: 'en-US' },
      { code: 'ja', name: '日本語', file: 'ja.json', language: 'ja-JP' },
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
    name: siteName,
    description: siteDescription,
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
    format: ['webp', 'avif', 'jpeg', 'jpg', 'png'],
  },
  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: siteName,
      short_name: 'Liora',
      description: siteDescription,
      theme_color: pwaBackgroundColorLight,
      background_color: pwaBackgroundColorLight,
      start_url: '/',
      scope: '/',
      display: 'standalone',
      lang: defaultLocale,
      icons: [
        { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        { src: '/pwa-512x512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
      ],
    },
  },
  eslint: {
    config: {
      standalone: false,
    },
  },
  sentry: {
    sourceMapsUploadOptions: {
      org: 'jannchie-studio',
      project: 'liora',
    },
  },
  sourcemap: {
    client: 'hidden',
  },
})
