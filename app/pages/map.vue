<script setup lang="ts">
import type { MapController, SheetSnap } from '@mapette/core'
import type { FileResponse, PhotoLocation } from '~/types/file'
import type { MapBounds } from '~/utils/photo-map'
import { directions } from '@mapette/core'
import { MapExplorer } from '@mapette/vue'
import { computed, onMounted, ref, shallowRef, watch } from 'vue'
import { useSiteSettingsState } from '~/composables/useSiteSettings'
import { isInBounds, PHOTO_MAP_KEEP_SOURCES, photoMapStyle, toMapLocale } from '~/utils/photo-map'

// The map view: every geotagged photo on a full-screen map, with a side
// panel (bottom sheet on phones) listing what is in view or detailing the
// picked photo. The skeleton — map, controls, panel, keyboard — is mapette's.
definePageMeta({
  layout: false,
})

const { t, locale } = useI18n()
const thumb = usePhotoThumb()
const mapLocale = computed(() => toMapLocale(locale.value))

const { settings: siteSettings, load: loadSiteSettings } = useSiteSettingsState()
const siteName = computed(() => siteSettings.value?.name?.trim() || t('home.defaultTitle'))

const { data: points, pending } = useFetch<PhotoLocation[]>('/api/files/locations', {
  default: () => [],
  server: false,
})
const pointsById = computed(() => new Map(points.value.map(point => [point.id, point])))

// ---- The picked photo, kept in ?photo=<id> so the view can be shared ----
const focusId = ref<number | null>(null)
const focus = computed<PhotoLocation | null>(() => (focusId.value === null ? null : pointsById.value.get(focusId.value) ?? null))
const focusDetail = shallowRef<FileResponse | null>(null)
const sheet = ref<SheetSnap>('half')

function pick(id: number | null): void {
  focusId.value = id
  if (id !== null) {
    sheet.value = 'half'
    document.querySelector('.mapette-sheet-body')?.scrollTo({ top: 0 })
  }
}

let detailSeq = 0
watch(focusId, async (id) => {
  const url = new URL(location.href)
  if (id === null) {
    url.searchParams.delete('photo')
  }
  else {
    url.searchParams.set('photo', String(id))
  }
  history.replaceState(history.state, '', url)

  const seq = ++detailSeq
  focusDetail.value = null
  if (id === null) {
    return
  }
  const detail = await $fetch<FileResponse>(`/api/files/${id}`).catch(() => null)
  if (seq === detailSeq) {
    focusDetail.value = detail
  }
})

// ---- Photos in the visible area, newest first ----
const LIST_LIMIT = 60
const bounds = shallowRef<MapBounds | null>(null)
const inView = computed<PhotoLocation[]>(() => {
  const b = bounds.value
  if (!b) {
    return []
  }
  return points.value.filter(point => isInBounds(point, b))
})
const listed = computed(() => inView.value.slice(0, LIST_LIMIT))

// ---- Initial view: a shared photo, the URL's #map= view, or all photos ----
const explorer = ref<InstanceType<typeof MapExplorer>>()
const controller = shallowRef<MapController | null>(null)
let framed = false
// Read before the map exists: mapette writes the current view into #map= as
// soon as it is created, so later the hash no longer tells a shared view apart.
const hasSharedView = import.meta.client && location.hash.includes('map=')

function frameInitialView(): void {
  const map = controller.value?.map
  if (framed || !map || points.value.length === 0) {
    return
  }
  framed = true
  if (focus.value) {
    map.jumpTo({ center: [focus.value.longitude, focus.value.latitude], zoom: Math.max(map.getZoom(), 15) })
    return
  }
  if (hasSharedView) {
    return
  }
  let [west, south, east, north] = [180, 90, -180, -90]
  for (const point of points.value) {
    west = Math.min(west, point.longitude)
    east = Math.max(east, point.longitude)
    south = Math.min(south, point.latitude)
    north = Math.max(north, point.latitude)
  }
  map.fitBounds([[west, south], [east, north]], { padding: 64, maxZoom: 14, duration: 0 })
}

function onLoad(ctrl: MapController): void {
  controller.value = ctrl
  frameInitialView()
}
watch(points, frameInitialView)

function showOnMap(point: PhotoLocation): void {
  const map = controller.value?.map
  map?.flyTo({ center: [point.longitude, point.latitude], zoom: Math.max(map.getZoom(), 16), duration: 1200 })
}

// ---- Detail fields ----
function formatDateTime(value: string): string {
  if (!value) {
    return ''
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return new Intl.DateTimeFormat(locale.value || undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(parsed)
}

function formatDate(value: string): string {
  const parsed = new Date(value)
  if (!value || Number.isNaN(parsed.getTime())) {
    return ''
  }
  return new Intl.DateTimeFormat(locale.value || undefined, { dateStyle: 'medium' }).format(parsed)
}

const photoTitle = (point: PhotoLocation): string => point.title || point.place || t('common.labels.untitled')
const coordinates = (point: PhotoLocation): string => `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`

const exposure = computed(() => {
  const metadata = focusDetail.value?.metadata
  if (!metadata) {
    return []
  }
  return [
    { label: t('gallery.metadata.focalLength'), value: metadata.focalLength },
    { label: t('gallery.metadata.aperture'), value: metadata.aperture },
    { label: t('gallery.metadata.shutterSpeed'), value: metadata.shutterSpeed },
    { label: t('gallery.metadata.iso'), value: metadata.iso },
  ].filter(entry => entry.value?.trim())
})
const device = computed(() => {
  const metadata = focusDetail.value?.metadata
  return [metadata?.cameraModel, metadata?.lensModel].map(value => value?.trim()).filter(Boolean).join(' · ')
})

// Esc steps back out of the detail; with nothing picked it falls through.
const shortcuts = {
  Escape: () => {
    if (focusId.value === null) {
      return false
    }
    pick(null)
  },
}

onMounted(() => {
  void loadSiteSettings()
  const id = Number.parseInt(new URLSearchParams(location.search).get('photo') ?? '', 10)
  if (Number.isFinite(id) && id > 0) {
    focusId.value = id
  }
})

usePageSeo({
  title: () => `${t('mapView.title')} · ${siteName.value}`,
  description: () => t('mapView.description'),
})
</script>

<template>
  <div class="font-prose">
    <MapExplorer
      ref="explorer"
      v-model:snap="sheet"
      :map-style="photoMapStyle"
      :locale="mapLocale"
      :keep-sources="PHOTO_MAP_KEEP_SOURCES"
      :shortcuts="shortcuts"
      @load="onLoad"
    >
      <template #map>
        <PhotoMapLayers :points="points" :focus="focus" @pick="pick" @bounds="(next) => (bounds = next)" />
      </template>

      <!-- Title only while browsing; the detail takes the space when a photo is open. -->
      <template v-if="!focus" #header>
        <div class="flex items-center gap-2 px-3 pb-2 pt-3">
          <UButton
            to="/"
            color="neutral"
            variant="ghost"
            size="sm"
            square
            icon="jannchie:chevron-left"
            :aria-label="t('mapView.backToGallery')"
            :title="t('mapView.backToGallery')"
          />
          <div class="min-w-0">
            <h1 class="truncate text-[15px] font-semibold tracking-[-0.01em] text-highlighted">
              {{ siteName }}
            </h1>
            <p class="num-tabular text-xs text-dimmed">
              <template v-if="pending">
                {{ t('common.loading') }}
              </template>
              <template v-else>
                {{ t('mapView.photoCount', points.length) }}
              </template>
            </p>
          </div>
        </div>
      </template>

      <div class="px-3 pb-3">
        <!-- The picked photo -->
        <article v-if="focus" :key="focus.id">
          <div class="sticky top-0 z-10 -mx-3 mb-2 flex items-center justify-between bg-[var(--mapette-bg)] px-2 py-2 backdrop-blur-xl">
            <UButton color="neutral" variant="ghost" size="sm" icon="jannchie:chevron-left" @click="pick(null)">
              {{ t('mapView.back') }}
            </UButton>
            <UButton
              color="neutral"
              variant="ghost"
              size="sm"
              square
              icon="jannchie:x"
              :aria-label="t('common.actions.close')"
              @click="pick(null)"
            />
          </div>
          <NuxtLink
            :to="`/photo/${focus.id}`"
            class="block max-h-[60vh] overflow-hidden rounded-md bg-muted outline-none focus-visible:shadow-[var(--ring-focus)]"
            :style="{ aspectRatio: `${focus.width} / ${focus.height}` }"
            :title="t('mapView.openPhoto')"
          >
            <img :src="thumb(focus.imageUrl, 720)" :alt="photoTitle(focus)" class="block h-full w-full object-cover">
          </NuxtLink>
          <h2 class="mt-3 text-[15px] font-semibold leading-snug text-highlighted [overflow-wrap:anywhere]">
            {{ photoTitle(focus) }}
          </h2>
          <p v-if="focus.title && focus.place" class="mt-0.5 text-[13px] text-dimmed">
            {{ focus.place }}
          </p>

          <dl class="mt-3 text-[13px]">
            <div v-if="focus.captureTime" class="flex gap-3 border-b border-border py-1.5">
              <dt class="w-16 shrink-0 text-dimmed">
                {{ t('gallery.metadata.captureTime') }}
              </dt>
              <dd class="num-tabular text-toned">
                {{ formatDateTime(focus.captureTime) }}
              </dd>
            </div>
            <div class="flex gap-3 border-b border-border py-1.5">
              <dt class="w-16 shrink-0 text-dimmed">
                {{ t('gallery.metadata.location') }}
              </dt>
              <dd class="num-tabular text-toned">
                {{ coordinates(focus) }}
              </dd>
            </div>
            <div v-if="device" class="flex gap-3 border-b border-border py-1.5">
              <dt class="w-16 shrink-0 text-dimmed">
                {{ t('gallery.metadata.device') }}
              </dt>
              <dd class="text-toned [overflow-wrap:anywhere]">
                {{ device }}
              </dd>
            </div>
          </dl>
          <ul v-if="exposure.length > 0" class="mt-3 grid grid-cols-[repeat(auto-fit,minmax(68px,1fr))] gap-1.5">
            <li v-for="entry in exposure" :key="entry.label" class="flex flex-col gap-0.5 rounded-md bg-muted px-2.5 py-2">
              <span class="text-[11px] text-dimmed">{{ entry.label }}</span>
              <b class="num-tabular text-[13px] font-semibold text-highlighted">{{ entry.value }}</b>
            </li>
          </ul>

          <div class="mt-4 flex flex-col gap-2">
            <UButton :to="`/photo/${focus.id}`" block icon="jannchie:image">
              {{ t('mapView.openPhoto') }}
            </UButton>
            <div class="flex gap-2">
              <UButton class="flex-1" block color="neutral" variant="soft" icon="jannchie:focus" @click="showOnMap(focus)">
                {{ t('mapView.showOnMap') }}
              </UButton>
              <UButton
                class="flex-1"
                block
                color="neutral"
                variant="soft"
                icon="jannchie:external-link"
                :href="directions.google(focus.latitude, focus.longitude)"
                target="_blank"
                rel="noopener noreferrer"
              >
                {{ t('mapView.directions') }}
              </UButton>
            </div>
          </div>
        </article>

        <!-- Photos in the visible area -->
        <section v-else>
          <p class="num-tabular mx-1 mb-2.5 text-xs text-dimmed">
            {{ inView.length > LIST_LIMIT ? t('mapView.inViewTruncated', { count: inView.length, shown: LIST_LIMIT }) : t('mapView.inView', inView.length) }}
          </p>
          <p v-if="!pending && inView.length === 0" class="mx-1 text-[13px] text-dimmed">
            {{ points.length === 0 ? t('mapView.empty') : t('mapView.emptyHere') }}
          </p>
          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="point in listed"
              :key="point.id"
              type="button"
              class="group flex min-w-0 flex-col gap-1 text-left outline-none"
              :title="photoTitle(point)"
              @click="pick(point.id)"
            >
              <img
                :src="thumb(point.imageUrl, 320)"
                alt=""
                loading="lazy"
                class="aspect-[4/3] w-full rounded-md bg-muted object-cover group-hover:outline-2 group-hover:outline-[var(--mapette-accent)] group-focus-visible:outline-2 group-focus-visible:outline-[var(--mapette-accent)]"
              >
              <span class="line-clamp-1 text-xs text-toned">{{ photoTitle(point) }}</span>
              <span v-if="point.captureTime" class="num-tabular -mt-1 text-[11px] text-dimmed">{{ formatDate(point.captureTime) }}</span>
            </button>
          </div>
        </section>
      </div>

      <template #footer>
        <div class="flex items-center gap-1 px-2 py-1.5 text-[11px] text-dimmed">
          <span class="min-w-0 flex-1 truncate px-1">
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" class="hover:text-fg-highlighted">© OpenStreetMap</a>
            ·
            <a href="https://openfreemap.org/" target="_blank" rel="noopener noreferrer" class="hover:text-fg-highlighted">OpenFreeMap</a>
          </span>
          <UThemeToggle />
          <LanguageSwitcher />
        </div>
      </template>
    </MapExplorer>
  </div>
</template>
