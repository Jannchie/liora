<script setup lang="ts">
import type { FileLocation } from '~/types/gallery'
import { computed } from 'vue'

const props = defineProps<{
  location: FileLocation
}>()

const { t } = useI18n()

const latitudeText = computed(() => props.location.latitude.toFixed(5))
const longitudeText = computed(() => props.location.longitude.toFixed(5))

const zoom = 14
const embedPadding = 0.01
const embedUrl = computed(() => {
  const lat = latitudeText.value
  const lon = longitudeText.value
  const bbox = [
    (props.location.longitude - embedPadding).toFixed(5),
    (props.location.latitude - embedPadding).toFixed(5),
    (props.location.longitude + embedPadding).toFixed(5),
    (props.location.latitude + embedPadding).toFixed(5),
  ]
    .map(value => encodeURIComponent(value))
    .join('%2C')

  const marker = `${encodeURIComponent(lat)}%2C${encodeURIComponent(lon)}`
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${marker}`
})

const externalLink = computed(() => {
  const lat = latitudeText.value
  const lon = longitudeText.value
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=${zoom}/${lat}/${lon}`
})

const locationLabel = computed(() => props.location.label?.trim() || t('gallery.map.defaultLabel'))
const altText = computed(() => t('gallery.map.alt', { location: locationLabel.value }))
</script>

<template>
  <section class="rounded-md border border-default/20 bg-elevated/80 p-3">
    <div class="mb-2 flex items-start justify-between gap-3">
      <div class="space-y-0.5">
        <p class="text-sm font-semibold text-highlighted">
          {{ t('gallery.map.title') }}
        </p>
        <p class="text-xs text-muted">
          {{ locationLabel }}
        </p>
      </div>
      <a
        class="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-primary ring-1 ring-primary/30 transition hover:bg-primary/10"
        :href="externalLink"
        target="_blank"
        rel="noreferrer"
      >
        <Icon name="carbon:launch" class="h-3.5 w-3.5" />
        <span>{{ t('gallery.map.openExternal') }}</span>
      </a>
    </div>
    <div class="overflow-hidden rounded-sm border border-default/20 bg-muted">
      <iframe
        :title="altText"
        :src="embedUrl"
        class="h-[180px] w-full border-0"
        loading="lazy"
      />
    </div>
  </section>
</template>
