import * as Sentry from '@sentry/nuxt'

const runtimeConfig = useRuntimeConfig()
const sentryConfig = (runtimeConfig.public.sentry ?? {}) as {
  dsn?: string
  tracesSampleRate?: number
  sendDefaultPii?: boolean
  environment?: string
}
const dsn = sentryConfig.dsn ?? ''

// Only initialise Sentry when a DSN is provided. This keeps self-hosted forks
// from silently shipping errors to the upstream project's Sentry instance.
if (dsn) {
  Sentry.init({
    dsn,

    // Performance tracing. Disabled by default; opt in via runtime config.
    tracesSampleRate: sentryConfig.tracesSampleRate ?? 0,

    // Enable logs to be sent to Sentry
    enableLogs: true,

    // Personally Identifiable Information is opt-in for privacy reasons.
    sendDefaultPii: sentryConfig.sendDefaultPii ?? false,

    environment: sentryConfig.environment,

    debug: false,
  })
}
