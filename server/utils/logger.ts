/* eslint-disable no-console */
// Centralised structured logger for the server runtime.
//
// In production each entry is emitted as a single JSON line (time, level, msg,
// plus context) so it can be ingested by log aggregators. In development the
// output is human-readable. This is the only module allowed to call `console`
// directly — everything else should go through `logger`.

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

type LogContext = Record<string, unknown>

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

const isProduction = process.env.NODE_ENV === 'production'
const minLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel | undefined) ?? (isProduction ? 'info' : 'debug')

function serializeError(error: unknown): LogContext {
  if (error instanceof Error) {
    return { error: { name: error.name, message: error.message, stack: error.stack } }
  }
  return { error }
}

function normalizeContext(context?: LogContext): LogContext {
  if (!context) {
    return {}
  }
  const normalized: LogContext = {}
  for (const [key, value] of Object.entries(context)) {
    normalized[key] = value instanceof Error ? serializeError(value).error : value
  }
  return normalized
}

function emit(level: LogLevel, msg: string, context?: LogContext): void {
  if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[minLevel]) {
    return
  }

  const entry = { time: new Date().toISOString(), level, msg, ...normalizeContext(context) }
  const sink = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log

  if (isProduction) {
    sink(JSON.stringify(entry))
    return
  }

  const { time, level: _level, msg: _msg, ...rest } = entry
  const tail = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : ''
  sink(`[${time}] ${level.toUpperCase()} ${msg}${tail}`)
}

export interface Logger {
  debug: (msg: string, context?: LogContext) => void
  info: (msg: string, context?: LogContext) => void
  warn: (msg: string, context?: LogContext) => void
  error: (msg: string, context?: LogContext) => void
  child: (bindings: LogContext) => Logger
}

function createLogger(bindings: LogContext = {}): Logger {
  const merge = (context?: LogContext): LogContext => ({ ...bindings, ...context })
  return {
    debug: (msg, context) => emit('debug', msg, merge(context)),
    info: (msg, context) => emit('info', msg, merge(context)),
    warn: (msg, context) => emit('warn', msg, merge(context)),
    error: (msg, context) => emit('error', msg, merge(context)),
    child: childBindings => createLogger({ ...bindings, ...childBindings }),
  }
}

export const logger: Logger = createLogger()
