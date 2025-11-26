<script setup lang="ts">
import type { FileLocation } from '~/types/gallery'
import { computed } from 'vue'

const props = defineProps<{
  location: FileLocation
}>()

const { t } = useI18n()

const latitudeText = computed(() => props.location.latitude.toFixed(5))
const longitudeText = computed(() => props.location.longitude.toFixed(5))

const coordinatePattern = /^-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/

const formatCoordinateValue = (value: number, positive: string, negative: string): string => {
  const direction = value >= 0 ? positive : negative
  const absolute = Math.abs(value).toFixed(4)
  return `${absolute}° ${direction}`
}

const formattedCoordinates = computed(() => {
  const lat = formatCoordinateValue(props.location.latitude, 'N', 'S')
  const lon = formatCoordinateValue(props.location.longitude, 'E', 'W')
  return `${lat}, ${lon}`
})

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

const locationLabel = computed(() => {
  const label = props.location.label?.trim()
  if (label && !coordinatePattern.test(label)) {
    return label
  }
  return formattedCoordinates.value
})
const altText = computed(() => t('gallery.map.alt', { location: locationLabel.value }))
</script>

<template>
  <section class="rounded-md border border-default/20 bg-elevated/80 p-3">
    <div class="mb-2 space-y-0.5">
      <p class="text-sm font-semibold text-highlighted">
        {{ t('gallery.map.title') }}
      </p>
      <p class="text-xs text-muted truncate" :title="locationLabel">
        {{ locationLabel }}
      </p>
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
