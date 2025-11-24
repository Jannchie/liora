import type { SessionState } from '~/types/auth'
import { createError, readBody } from 'h3'
import { createSession, validateCredentials } from '../../utils/auth'

interface LoginBody {
  username?: string
  password?: string
}

export default defineEventHandler(async (event): Promise<SessionState> => {
  const body = await readBody<LoginBody>(event)
  const username = body.username?.toString().trim() ?? ''
  const password = body.password?.toString() ?? ''

  if (!username || !password) {
    throw createError({ statusCode: 400, statusMessage: 'Username and password are required.' })
  }

  if (!validateCredentials(event, username, password)) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid credentials.' })
  }

  return createSession(event, username)
})
