import type { SessionState } from '~/types/auth'

export default defineNuxtRouteMiddleware(async () => {
  const cache = useState<SessionState | null>('admin-session-cache', () => null)
  const checkedAt = useState<number>('admin-session-checked-at', () => 0)
  const cacheTtlMs = 15_000
  const now = Date.now()

  if (import.meta.client && cache.value?.authenticated && now - checkedAt.value < cacheTtlMs) {
    return
  }

  const headers = useRequestHeaders(['cookie'])

  try {
    const session = await $fetch<SessionState>('/api/auth/session', {
      headers,
    })
    cache.value = session
    checkedAt.value = now
    if (!session.authenticated) {
      return navigateTo('/admin/login')
    }
  }
  catch {
    cache.value = null
    checkedAt.value = now
    return navigateTo('/admin/login')
  }
})
