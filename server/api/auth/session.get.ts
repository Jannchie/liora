import type { SessionState } from '~/types/auth'
import { readSession } from '../../utils/auth'

export default defineEventHandler(async (event): Promise<SessionState> => {
  return readSession(event)
})
