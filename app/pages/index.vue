<script setup lang="ts">
function normalizeRouteParam(param: string | string[] | null | undefined): string {
  if (Array.isArray(param)) {
    return param.find((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0) ?? ''
  }
  return typeof param === 'string' ? param : ''
}

definePageMeta({
  layout: 'gallery',
  path: String.raw`/:section(photo)?/:id(\d+)?`,
  validate: (route) => {
    const section = normalizeRouteParam(route.params.section)
    const id = normalizeRouteParam(route.params.id)
    if (!section) {
      return id.length === 0
    }
    if (section !== 'photo') {
      return false
    }
    return id.length > 0 && /^\d+$/.test(id)
  },
})
</script>

<template>
  <div class="hidden" />
</template>
