// @ts-check
import jannchie from '@jannchie/eslint-config'
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(jannchie({ rules: {
  'node/prefer-global/process': 'off',
  'node/prefer-global/buffer': 'off',
  'unicorn/import-style': 'off',
} }), {
  ignores: ['app/generated/prisma/**'],
})
