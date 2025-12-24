import type { RouterConfig } from '@nuxt/schema'

export default {
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    }
    if (to.name === from.name) {
      return false
    }
    return { left: 0, top: 0 }
  },
} satisfies RouterConfig
