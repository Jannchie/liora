import type { SessionState } from '~/types/auth'
import { clearSession } from '../../utils/auth'

export default defineEventHandler(async (event): Promise<SessionState> => {
  clearSession(event)
  return { authenticated: false }
})
