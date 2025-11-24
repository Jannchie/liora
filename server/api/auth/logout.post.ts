import type { SessionState } from '~/types/auth'
import { clearAdminSession } from '../../utils/auth'

export default defineEventHandler(async (event): Promise<SessionState> => {
  clearAdminSession(event)
  return { authenticated: false }
})
