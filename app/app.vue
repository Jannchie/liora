<script setup lang="ts">
import { computed } from 'vue'

const route = useRoute()

const pageKey = computed<string>(() => {
  const name = route.name
  if (name === 'index' || name === 'photo-id') {
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
