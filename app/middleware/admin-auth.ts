import type { SessionState } from '~/types/auth'

export default defineNuxtRouteMiddleware(async () => {
  const headers = useRequestHeaders(['cookie'])

  try {
    const session = await $fetch<SessionState>('/api/auth/session', {
      headers,
    })
    if (!session.authenticated) {
      return navigateTo('/admin/login')
    }
  }
  catch {
    return navigateTo('/admin/login')
  }
})
