import { useSiteSettingsState } from '~/composables/useSiteSettings'

export default defineNuxtPlugin(async () => {
  const { iconUrl, load } = useSiteSettingsState()

  await load()

  useHead({
    link: [
      { rel: 'icon', type: 'image/x-icon', href: iconUrl },
      { rel: 'shortcut icon', type: 'image/x-icon', href: iconUrl },
      { rel: 'apple-touch-icon', href: iconUrl },
    ],
  })
})
