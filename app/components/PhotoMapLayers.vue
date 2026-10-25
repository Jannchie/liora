<script setup lang="ts">
import type { GeoJSONSource, MapGeoJSONFeature } from 'maplibre-gl'
import type { PhotoLocation } from '~/types/file'
import type { MapBounds } from '~/utils/photo-map'
import { ClusterPopover, PhotoPins, useMap } from '@mapette/vue'
import { computed, watch } from 'vue'
import { FOCUS_SOURCE, PHOTO_SOURCE, toFocusFeatures, toPhotoFeatures } from '~/utils/photo-map'

const props = defineProps<{
  points: PhotoLocation[]
  focus: PhotoLocation | null
}>()

const emit = defineEmits<{
  pick: [id: number]
  /** Visible area after every pan / zoom. */
  bounds: [bounds: MapBounds]
}>()

const { t } = useI18n()
const thumb = usePhotoThumb()
const { controller } = useMap()

const pointsById = computed(() => new Map(props.points.map(point => [point.id, point])))
const featureId = (f: { properties?: Record<string, unknown> | null }): number => Number(f.properties?.id)

// A photo picked on the map is already in view; only picks from the panel
// or a shared link pan the map to it.
let pickedOnMap: number | null = null
function pick(id: number): void {
  pickedOnMap = id
  emit('pick', id)
}

function syncPhotos(): void {
  const source = controller.value?.map.getSource(PHOTO_SOURCE) as GeoJSONSource | undefined
  source?.setData(toPhotoFeatures(props.points))
}

function syncFocus(): void {
  const source = controller.value?.map.getSource(FOCUS_SOURCE) as GeoJSONSource | undefined
  source?.setData(toFocusFeatures(props.focus))
}

watch(controller, (ctrl) => {
  if (!ctrl) {
    return
  }
  const map = ctrl.map
  // First load and every restyle (theme / language switch).
  ctrl.onStyleLoad(() => {
    syncPhotos()
    syncFocus()
  })
  map.on('click', 'point', (event) => {
    const feature = event.features?.[0]
    if (feature) {
      pick(featureId(feature))
    }
  })
  map.on('mouseenter', 'point', () => {
    map.getCanvas().style.cursor = 'pointer'
  })
  map.on('mouseleave', 'point', () => {
    map.getCanvas().style.cursor = ''
  })
  const reportBounds = (): void => {
    const b = map.getBounds()
    emit('bounds', [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()])
  }
  map.on('moveend', reportBounds)
  if (map.loaded()) {
    reportBounds()
  }
  else {
    map.once('load', reportBounds)
  }
}, { immediate: true })

watch(() => props.points, syncPhotos)

watch(() => props.focus, (point) => {
  syncFocus()
  if (point && point.id !== pickedOnMap) {
    controller.value?.reveal([point.longitude, point.latitude])
  }
  pickedOnMap = null
})

function pinImages(features: MapGeoJSONFeature[]): (string | null)[] {
  return features.map((feature) => {
    const point = pointsById.value.get(featureId(feature))
    return point ? thumb(point.imageUrl, 160) : null
  })
}

function clusterPoints(features: { properties?: Record<string, unknown> | null }[]): PhotoLocation[] {
  const list: PhotoLocation[] = []
  for (const feature of features) {
    const point = pointsById.value.get(featureId(feature))
    if (point) {
      list.push(point)
    }
  }
  return list
}
</script>

<template>
  <!-- Tapping a bubble lists its photos instead of zooming in. -->
  <ClusterPopover :source="PHOTO_SOURCE">
    <template #default="{ features, count, close }">
      <div class="photo-cluster">
        <div class="photo-cluster-head num-tabular">
          {{ t('mapView.photoCount', count) }}
        </div>
        <div class="photo-cluster-grid">
          <button
            v-for="point in clusterPoints(features)"
            :key="point.id"
            type="button"
            :title="point.title || point.place"
            @click="close(); emit('pick', point.id)"
          >
            <img :src="thumb(point.imageUrl, 200)" alt="" loading="lazy">
          </button>
        </div>
      </div>
    </template>
  </ClusterPopover>
  <PhotoPins
    :layers="['point']"
    :feature-key="featureId"
    :images="pinImages"
    :focus="focus?.id ?? null"
    :min-zoom="15"
    :max="24"
    @pick="(feature) => pick(featureId(feature))"
  />
</template>

<style scoped>
.photo-cluster {
  width: 252px;
  padding-bottom: 8px;
  font-size: 13px;
}

/* Sticky so the count stays visible while the grid scrolls inside the
   popover; no z-index, which would cover the popover's close button. */
.photo-cluster-head {
  position: sticky;
  top: 0;
  padding: 10px 40px 8px 12px;
  font-weight: 600;
  background: var(--mapette-bg-solid);
}

.photo-cluster-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  padding: 0 8px;
}

.photo-cluster-grid button {
  padding: 0;
  background: none;
  border: 0;
  cursor: pointer;
}

.photo-cluster-grid img {
  display: block;
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 6px;
  background: var(--mapette-hover);
}

.photo-cluster-grid button:hover img,
.photo-cluster-grid button:focus-visible img {
  outline: 2px solid var(--mapette-accent);
}
</style>
