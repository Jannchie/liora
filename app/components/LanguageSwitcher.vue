<script setup lang="ts">
import { computed } from 'vue'

const { locale, locales, t } = useI18n()

const options = computed(() => locales.value.map((item) => {
  const label = typeof item === 'string' ? t(`locales.${item}`) : item.name ?? t(`locales.${item.code}`)
  const value = typeof item === 'string' ? item : item.code
  return { label, value }
}))
const model = computed({
  get: () => locale.value,
  set: (value: string | number | null | undefined) => {
    if (typeof value === 'string') {
      locale.value = value
    }
  },
})
</script>

<template>
  <USelect
    v-model="model"
    :items="options"
    :size="size"
    :aria-label="t('common.actions.switchLanguage')"
  />
</template>
