<script setup lang="ts">
import { computed } from 'vue'

type DetectBrowserLanguageCookieOptions = {
  cookieKey?: string
  cookieCrossOrigin?: boolean
  cookieSecure?: boolean
  cookieDomain?: string
}

const { locale, locales, t, setLocale } = useI18n()
const runtimeConfig = useRuntimeConfig()

function resolveDetectBrowserLanguage(): DetectBrowserLanguageCookieOptions | null {
  const raw = runtimeConfig.public?.i18n?.detectBrowserLanguage
  if (!raw || typeof raw !== 'object') {
    return null
  }
  return raw as DetectBrowserLanguageCookieOptions
}

const detectBrowserLanguage = resolveDetectBrowserLanguage()

const cookieExpires = new Date()
cookieExpires.setFullYear(cookieExpires.getFullYear() + 1)

const localeCookie = useCookie<string | null>(detectBrowserLanguage?.cookieKey ?? 'i18n_redirected', {
  path: '/',
  expires: cookieExpires,
  sameSite: detectBrowserLanguage?.cookieCrossOrigin ? 'none' : 'lax',
  secure: Boolean(detectBrowserLanguage?.cookieCrossOrigin || detectBrowserLanguage?.cookieSecure),
  domain: detectBrowserLanguage?.cookieDomain || undefined,
})

const options = computed(() => locales.value.map((item) => {
  const label = typeof item === 'string' ? t(`locales.${item}`) : item.name ?? t(`locales.${item.code}`)
  const value = typeof item === 'string' ? item : item.code
  return { label, value }
}))

function isLocaleCode(value: unknown): value is typeof locale.value {
  if (typeof value !== 'string') {
    return false
  }
  const codes = locales.value.map(entry => (typeof entry === 'string' ? entry : entry.code))
  return codes.includes(value as typeof locale.value)
}

const model = computed({
  get: () => locale.value,
  set: async (value: string | number | null | undefined) => {
    if (isLocaleCode(value)) {
      await setLocale(value)
      localeCookie.value = value
    }
  },
})
</script>

<template>
  <USelect
    v-model="model"
    :items="options"
    :aria-label="t('common.actions.switchLanguage')"
  />
</template>
