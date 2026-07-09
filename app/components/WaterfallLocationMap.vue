<script setup lang="ts">
import type { Map as MaplibreMap, Marker } from 'maplibre-gl'
import type { FileLocation } from '~/types/gallery'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{
  location: FileLocation
}>()

const { t } = useI18n()

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

/*
 * CARTO free basemaps (mapcn-style look): vector tiles, no API key.
 * positron for light mode, dark-matter for dark mode — swapped at runtime
 * by watching the resolved theme class on <html>.
 */
const MAP_STYLES = {
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
} as const

const DEFAULT_ZOOM = 13

const mapContainer = ref<HTMLDivElement | null>(null)
const mapReady = ref(false)

let map: MaplibreMap | null = null
let marker: Marker | null = null
let themeObserver: MutationObserver | null = null

function resolveTheme(): 'light' | 'dark' {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

/*
 * Built imperatively instead of in the template: maplibre's Marker adopts the
 * element into the map's DOM, and moving a Vue-managed node breaks the next
 * patch (insertBefore on a detached anchor). bg-primary follows the theme via
 * CSS variables, so no rebuild is needed on theme switch.
 */
function createMarkerElement(): HTMLDivElement {
  const root = document.createElement('div')
  root.className = 'relative flex h-3.5 w-3.5'
  root.setAttribute('aria-hidden', 'true')
  const ping = document.createElement('span')
  ping.className = 'absolute inline-flex h-full w-full rounded-full bg-primary opacity-60 motion-safe:animate-ping'
  const dot = document.createElement('span')
  dot.className = 'relative inline-flex h-3.5 w-3.5 rounded-full bg-primary shadow-md ring-2 ring-white/90'
  root.append(ping, dot)
  return root
}

onMounted(async () => {
  const [maplibre] = await Promise.all([
    import('maplibre-gl'),
    import('maplibre-gl/dist/maplibre-gl.css'),
  ])
  if (!mapContainer.value) {
    return
  }

  let theme = resolveTheme()
  map = new maplibre.Map({
    container: mapContainer.value,
    style: MAP_STYLES[theme],
    center: [props.location.longitude, props.location.latitude],
    zoom: DEFAULT_ZOOM,
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
    attributionControl: false,
  })
  map.touchZoomRotate.disableRotation()
  // Bottom-left so it doesn't collide with the custom zoom controls.
  map.addControl(new maplibre.AttributionControl({ compact: true }), 'bottom-left')

  marker = new maplibre.Marker({ element: createMarkerElement() })
    .setLngLat([props.location.longitude, props.location.latitude])
    .addTo(map)

  map.once('load', () => {
    mapReady.value = true
    // Compact attribution starts expanded (set by _updateCompact on load) and
    // covers half the small map; collapse it to the ⓘ toggle — the full text
    // stays one click away.
    const attrib = mapContainer.value?.querySelector('details.maplibregl-ctrl-attrib')
    attrib?.classList.remove('maplibregl-compact-show')
    attrib?.removeAttribute('open')
  })

  themeObserver = new MutationObserver(() => {
    const next = resolveTheme()
    if (next !== theme && map) {
      theme = next
      map.setStyle(MAP_STYLES[next])
    }
  })
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
})

watch(
  () => [props.location.longitude, props.location.latitude] as const,
  ([lon, lat]) => {
    marker?.setLngLat([lon, lat])
    map?.jumpTo({ center: [lon, lat], zoom: DEFAULT_ZOOM })
  },
)

onBeforeUnmount(() => {
  themeObserver?.disconnect()
  themeObserver = null
  marker?.remove()
  marker = null
  map?.remove()
  map = null
})

function zoomBy(delta: number): void {
  if (!map) {
    return
  }
  map.zoomTo(map.getZoom() + delta, { duration: 250 })
}
</script>

<template>
  <section class="rounded-md border border-default/20 bg-elevated/80 p-3">
    <div class="mb-2 flex items-start justify-between gap-2">
      <div class="min-w-0 space-y-0.5">
        <p class="text-sm font-semibold text-highlighted">
          {{ t('gallery.map.title') }}
        </p>
        <p class="text-xs text-muted truncate" :title="locationLabel">
          {{ locationLabel }}
        </p>
      </div>
      <a
        :href="externalUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted outline-none transition-colors duration-150 ease-out hover:bg-accented hover:text-highlighted focus-visible:shadow-[var(--ring-focus)]"
        :title="t('gallery.map.openExternal')"
        :aria-label="t('gallery.map.openExternal')"
      >
        <Icon name="tabler:external-link" class="h-4 w-4 shrink-0" />
      </a>
    </div>
    <div class="relative overflow-hidden rounded-sm border border-default/20 bg-muted">
      <div
        ref="mapContainer"
        role="img"
        :aria-label="altText"
        class="h-45 w-full transition-opacity duration-300"
        :class="mapReady ? 'opacity-100' : 'opacity-0'"
      />
      <div
        v-if="mapReady"
        class="absolute right-2 bottom-2 z-10 flex flex-col overflow-hidden rounded-md border border-default/30 bg-elevated/90 shadow-sm backdrop-blur-sm"
      >
        <button
          type="button"
          class="inline-flex h-7 w-7 items-center justify-center text-muted outline-none transition-colors duration-150 ease-out hover:bg-accented hover:text-highlighted focus-visible:shadow-[var(--ring-focus)]"
          :aria-label="t('gallery.map.zoomIn')"
          @click="zoomBy(1)"
        >
          <Icon name="tabler:plus" class="h-3.5 w-3.5 shrink-0" />
        </button>
        <div class="h-px bg-default/30" />
        <button
          type="button"
          class="inline-flex h-7 w-7 items-center justify-center text-muted outline-none transition-colors duration-150 ease-out hover:bg-accented hover:text-highlighted focus-visible:shadow-[var(--ring-focus)]"
          :aria-label="t('gallery.map.zoomOut')"
          @click="zoomBy(-1)"
        >
          <Icon name="tabler:minus" class="h-3.5 w-3.5 shrink-0" />
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* The default maplibre attribution inherits the page font size and dwarfs
 * the 180px map; shrink both the expanded text and the ⓘ toggle. */
:deep(.maplibregl-ctrl-attrib) {
  font-size: 10px;
  line-height: 1.5;
}

:deep(.maplibregl-ctrl-attrib.maplibregl-compact) {
  min-height: 20px;
}

:deep(.maplibregl-ctrl-attrib-button) {
  width: 20px;
  height: 20px;
  background-size: 14px;
  background-position: center;
  background-repeat: no-repeat;
}
</style>
