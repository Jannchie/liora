import { computed } from 'vue'
import { useSiteSettingsState } from '~/composables/useSiteSettings'

export default defineNuxtPlugin(async () => {
  const { iconUrl, load, settings } = useSiteSettingsState()

  await load()

  const customCss = computed(() => settings.value?.customCss ?? '')

  useHead(() => {
    const css = customCss.value
    const shouldInjectCss = css.trim().length > 0

    return {
      link: [
        { rel: 'icon', type: 'image/x-icon', href: iconUrl.value },
        { rel: 'shortcut icon', type: 'image/x-icon', href: iconUrl.value },
        { rel: 'apple-touch-icon', href: iconUrl.value },
      ],
      style: shouldInjectCss
        ? [{ id: 'site-custom-css', key: 'site-custom-css', type: 'text/css', innerHTML: css }]
        : [],
    }
  })
})
