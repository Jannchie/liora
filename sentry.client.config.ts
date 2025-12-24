import * as Sentry from '@sentry/nuxt'

Sentry.init({
  // If set up, you can use your runtime config here
  // dsn: useRuntimeConfig().public.sentry.dsn,
  dsn: 'https://96ac1d27651c6066d90993296dbb0f7a@o4509038403911680.ingest.us.sentry.io/4510470986596352',

  // We recommend adjusting this value in production, or using tracesSampler
  // for finer control
  tracesSampleRate: 0,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Enable sending of user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nuxt/configuration/options/#sendDefaultPii
  sendDefaultPii: true,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,
})
