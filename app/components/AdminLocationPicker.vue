<script setup lang="ts">
import type { MapController } from '@mapette/core'
import type { MapMouseEvent } from 'maplibre-gl'
import { LocationMarker, MapControls, MapView } from '@mapette/vue'
import { computed, ref, watch } from 'vue'
import { readCoordinate } from '~/utils/exif-format'
import { toMapLocale } from '~/utils/photo-map'

// Click the map to set where a photo was taken. With no coordinates yet it
// opens on the last place picked, since photos tagged one after another are
// usually shot near each other.
const props = defineProps<{
  latitude: number | null | undefined
  longitude: number | null | undefined
}>()

const emit = defineEmits<{
  pick: [lngLat: [number, number]]
}>()

const { t, locale } = useI18n()
const mapLocale = computed(() => toMapLocale(locale.value))

const lastPicked = useState<[number, number] | null>('admin-location-picker:last', () => null)

const point = computed<[number, number] | null>(() => {
  const latitude = readCoordinate(props.latitude)
  const longitude = readCoordinate(props.longitude)
  return latitude === null || longitude === null ? null : [longitude, latitude]
})

const PLACE_ZOOM = 14
const WORLD: { center: [number, number], zoom: number } = { center: [0, 20], zoom: 0.5 }

// The view only follows the point when it moved from outside (typed, searched,
// another photo): a click is already where the user is looking.
const view = ref(resolveView())
let pickedHere: string | null = null

function resolveView(): { center: [number, number], zoom: number } {
  const target = point.value ?? lastPicked.value
  return target ? { center: target, zoom: PLACE_ZOOM } : WORLD
}

watch(point, (next) => {
  if (next) {
    lastPicked.value = next
  }
  const key = next ? next.join(',') : null
  if (key !== null && key === pickedHere) {
    return
  }
  pickedHere = null
  view.value = resolveView()
})

function onLoad(ctrl: MapController): void {
  const map = ctrl.map
  map.getCanvas().style.cursor = 'crosshair'
  map.on('click', (event: MapMouseEvent) => {
    const lngLat: [number, number] = [
      Number(event.lngLat.lng.toFixed(6)),
      Number(event.lngLat.lat.toFixed(6)),
    ]
    pickedHere = lngLat.join(',')
    emit('pick', lngLat)
  })
}
</script>

<template>
  <div class="space-y-1.5">
    <div class="h-56 overflow-hidden rounded-md border border-border bg-muted">
      <MapView preset="compact" :center="view.center" :zoom="view.zoom" :locale="mapLocale" @load="onLoad">
        <LocationMarker v-if="point" :lng-lat="point" />
        <MapControls :locate="false" />
      </MapView>
    </div>
    <p class="text-xs text-dimmed">
      {{ t('admin.upload.fields.locationMap.hint') }}
    </p>
  </div>
</template>
