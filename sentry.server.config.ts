import * as Sentry from '@sentry/nuxt'

const dsn = process.env.SENTRY_DSN ?? ''

// Only initialise Sentry when a DSN is provided. This keeps self-hosted forks
// from silently shipping errors to the upstream project's Sentry instance.
if (dsn) {
  Sentry.init({
    dsn,

    // Performance tracing. Disabled by default; opt in via env.
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0'),

    // Enable logs to be sent to Sentry
    enableLogs: true,

    // Personally Identifiable Information is opt-in for privacy reasons.
    sendDefaultPii: process.env.SENTRY_SEND_PII === 'true',

    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'production',

    debug: false,
  })
}
