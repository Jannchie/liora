<script setup lang="ts">
import { computed, watchEffect } from 'vue'

const route = useRoute()
const { locale } = useI18n()

type HtmlDir = 'ltr' | 'rtl' | 'auto' | undefined

const localeHead = useLocaleHead({
  dir: true,
  lang: true,
  seo: true,
})

function resolveDir(dir: string | undefined): HtmlDir {
  if (dir === 'ltr' || dir === 'rtl' || dir === 'auto') {
    return dir
  }
  return undefined
}

useHead(() => {
  const htmlLang = localeHead.value.htmlAttrs?.lang ?? locale.value
  const htmlDir = resolveDir(localeHead.value.htmlAttrs?.dir)

  return {
    htmlAttrs: {
      lang: htmlLang,
      dir: htmlDir,
    },
    link: localeHead.value.link ?? [],
    meta: localeHead.value.meta ?? [],
  }
})

if (import.meta.client) {
  watchEffect(() => {
    const htmlLang = localeHead.value.htmlAttrs?.lang ?? locale.value
    const htmlDir = resolveDir(localeHead.value.htmlAttrs?.dir)
    const root = document.documentElement

    root.lang = htmlLang
    if (htmlDir) {
      root.dir = htmlDir
    }
    else {
      root.removeAttribute('dir')
    }
  })
}

const pageKey = computed<string>(() => {
  const name = route.name
  if (name === 'index') {
    return 'gallery'
  }
  return route.fullPath
})
</script>

<template>
  <UApp>
    <NuxtPage :page-key="pageKey" />
  </UApp>
</template>
