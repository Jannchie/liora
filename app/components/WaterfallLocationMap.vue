<script setup lang="ts">
import type { FileLocation } from '~/types/gallery'
import { LocationMarker, MapControls, MapView } from '@mapette/vue'
import { computed } from 'vue'
import { toMapLocale } from '~/utils/photo-map'

const props = defineProps<{
  location: FileLocation
  /** Links the card to this photo on the map view. */
  photoId?: number
}>()

const { t, locale } = useI18n()

const latitudeText = computed(() => props.location.latitude.toFixed(5))
const longitudeText = computed(() => props.location.longitude.toFixed(5))

const coordinatePattern = /^-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/

function formatCoordinateValue(value: number, positive: string, negative: string): string {
  const direction = value >= 0 ? positive : negative
  const absolute = Math.abs(value).toFixed(4)
  return `${absolute}° ${direction}`
}

const formattedCoordinates = computed(() => {
  const lat = formatCoordinateValue(props.location.latitude, 'N', 'S')
  const lon = formatCoordinateValue(props.location.longitude, 'E', 'W')
  return `${lat}, ${lon}`
})

const locationLabel = computed(() => {
  const label = props.location.label?.trim()
  if (label && !coordinatePattern.test(label)) {
    return label
  }
  return formattedCoordinates.value
})
const altText = computed(() => t('gallery.map.alt', { location: locationLabel.value }))

const externalUrl = computed(() => {
  const lat = latitudeText.value
  const lon = longitudeText.value
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=15/${lat}/${lon}`
})

const mapLocale = computed(() => toMapLocale(locale.value))
const center = computed<[number, number]>(() => [props.location.longitude, props.location.latitude])
const mapViewUrl = computed(() => (props.photoId ? `/map?photo=${props.photoId}` : null))
</script>

<template>
  <!-- A section of the viewer's info column: caption + place, then the map. -->
  <section class="space-y-3 border-b border-border px-5 py-4">
    <div class="flex items-start justify-between gap-2">
      <div class="min-w-0 space-y-1">
        <p class="label-caption flex items-center gap-1.5 text-dimmed">
          <Icon name="jannchie:map-pin" class="h-3.5 w-3.5" />
          <span>{{ t('gallery.map.title') }}</span>
        </p>
        <p class="truncate text-[13px] text-highlighted" :class="locationLabel === formattedCoordinates ? 'num-tabular' : undefined" :title="locationLabel">
          {{ locationLabel }}
        </p>
        <p v-if="locationLabel !== formattedCoordinates" class="truncate num-tabular text-xs text-dimmed">
          {{ formattedCoordinates }}
        </p>
      </div>
      <div class="flex shrink-0 items-center gap-0.5">
        <NuxtLink
          v-if="mapViewUrl"
          :to="mapViewUrl"
          class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted outline-none transition-colors duration-150 ease-out hover:bg-muted hover:text-fg-highlighted focus-visible:shadow-[var(--ring-focus)]"
          :title="t('gallery.map.openInMapView')"
          :aria-label="t('gallery.map.openInMapView')"
        >
          <Icon name="jannchie:map-search" class="h-4 w-4 shrink-0" />
        </NuxtLink>
        <a
          :href="externalUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted outline-none transition-colors duration-150 ease-out hover:bg-muted hover:text-fg-highlighted focus-visible:shadow-[var(--ring-focus)]"
          :title="t('gallery.map.openExternal')"
          :aria-label="t('gallery.map.openExternal')"
        >
          <Icon name="jannchie:external-link" class="h-4 w-4 shrink-0" />
        </a>
      </div>
    </div>
    <div class="h-45 overflow-hidden rounded-md border border-border bg-muted" role="region" :aria-label="altText">
      <MapView preset="compact" :center="center" :zoom="13" :locale="mapLocale">
        <LocationMarker :lng-lat="center" pulse />
        <MapControls :locate="false" />
      </MapView>
    </div>
  </section>
</template>
