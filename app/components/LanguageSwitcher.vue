<script setup lang="ts">
import { computed } from 'vue'

const { locale, locales, t, setLocale } = useI18n()

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
  set: (value: string | number | null | undefined) => {
    if (isLocaleCode(value)) {
      void setLocale(value)
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
