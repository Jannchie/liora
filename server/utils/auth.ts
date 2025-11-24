import type { H3Event } from 'h3'
import type { SessionState } from '~/types/auth'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { useRuntimeConfig } from '#imports'
import { createError, deleteCookie, getCookie, setCookie } from 'h3'

const SESSION_COOKIE_NAME = 'liora_admin_session'
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

interface SessionPayload {
  username: string
  issuedAt: number
}

interface AdminConfig {
  username: string
  password: string
  sessionSecret: string
}

function resolveAdminConfig(event: H3Event): AdminConfig {
  const runtimeConfig = useRuntimeConfig(event) as { admin?: Partial<AdminConfig> }
  const username = runtimeConfig.admin?.username?.toString().trim() ?? ''
  const password = runtimeConfig.admin?.password?.toString() ?? ''
  const sessionSecret = runtimeConfig.admin?.sessionSecret?.toString() ?? ''

  if (!username || !password) {
    throw createError({ statusCode: 500, statusMessage: 'Admin credentials are not configured.' })
  }

  return {
    username,
    password,
    sessionSecret: sessionSecret || password,
  }
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }

  return timingSafeEqual(leftBuffer, rightBuffer)
}

function signPayload(payload: SessionPayload, secret: string): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const signature = createHmac('sha256', secret).update(encodedPayload).digest('hex')
  return `${encodedPayload}.${signature}`
}

function verifyToken(token: string, secret: string): SessionPayload | null {
  const [encoded, signature] = token.split('.')
  if (!encoded || !signature) {
    return null
  }

  const expected = createHmac('sha256', secret).update(encoded).digest('hex')
  const expectedBuffer = Buffer.from(expected)
  const signatureBuffer = Buffer.from(signature)
  if (expectedBuffer.length !== signatureBuffer.length || !timingSafeEqual(expectedBuffer, signatureBuffer)) {
    return null
  }

  try {
    const raw = Buffer.from(encoded, 'base64url').toString('utf8')
    const parsed = JSON.parse(raw) as Partial<SessionPayload>
    if (!parsed.username || typeof parsed.issuedAt !== 'number') {
      return null
    }
    return { username: parsed.username, issuedAt: parsed.issuedAt }
  }
  catch {
    return null
  }
}

export function createSession(event: H3Event, username: string): SessionState {
  const config = resolveAdminConfig(event)
  if (!safeEqual(username, config.username)) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid credentials.' })
  }
  const token = signPayload({ username: config.username, issuedAt: Date.now() }, config.sessionSecret)

  setCookie(event, SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  })

  return { authenticated: true, username: config.username }
}

export function clearSession(event: H3Event): void {
  deleteCookie(event, SESSION_COOKIE_NAME, { path: '/' })
}

export function readSession(event: H3Event): SessionState {
  const token = getCookie(event, SESSION_COOKIE_NAME)
  if (!token) {
    return { authenticated: false }
  }

  const config = resolveAdminConfig(event)
  const payload = verifyToken(token, config.sessionSecret)
  if (!payload || !safeEqual(payload.username, config.username)) {
    clearSession(event)
    return { authenticated: false }
  }

  return { authenticated: true, username: payload.username }
}

export function requireAdmin(event: H3Event): void {
  const session = readSession(event)
  if (!session.authenticated) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
}

export function validateCredentials(event: H3Event, username: string, password: string): boolean {
  const config = resolveAdminConfig(event)
  return safeEqual(username, config.username) && safeEqual(password, config.password)
}
