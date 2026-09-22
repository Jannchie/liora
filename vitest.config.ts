import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/*
 * Plain unit tests — no Nuxt runtime. `~` mirrors Nuxt's alias so a spec
 * can import an app module exactly as the source does.
 */
export default defineConfig({
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('app', import.meta.url)),
    },
  },
})
