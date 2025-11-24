const resolveDomains = (): string[] => {
  const domains = new Set<string>();
  const add = (value: string | undefined): void => {
    if (!value) {
      return;
    }
    try {
      const host = new URL(value).host;
      if (host) {
        domains.add(host);
      }
    } catch {
      // ignore invalid URLs
    }
  };

  add(process.env.S3_PUBLIC_BASE_URL);
  add(process.env.S3_ENDPOINT);
  return Array.from(domains);
};

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    storage: {
      endpoint: process.env.S3_ENDPOINT ?? '',
      bucket: process.env.S3_BUCKET ?? '',
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
      publicBaseUrl: process.env.S3_PUBLIC_BASE_URL ?? '',
    },
  },
  modules: [
    '@nuxt/eslint',
    '@nuxt/hints',
    '@nuxt/image',
    '@nuxt/ui',
    '@nuxt/test-utils'
  ],
  image: {
    domains: resolveDomains(),
    format: ['webp', 'avif', 'jpeg'],
  },
});
