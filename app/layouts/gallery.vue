<script setup lang="ts">
import type { SessionState } from '~/types/auth'
import type { FileMetadata, FileResponse, FileSummary } from '~/types/file'
import type { SiteInfoPlacement, SocialLink } from '~/types/gallery'
import type { SeriesSummary } from '~/types/series'
import type { SiteSettings } from '~/types/site'
import { defineOgImageComponent } from '#imports'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useSiteSettingsState } from '~/composables/useSiteSettings'

const { t } = useI18n()

function normalizeRouteParam(param: string | string[] | null | undefined): string {
  if (Array.isArray(param)) {
    return param.find((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0) ?? ''
  }
  return typeof param === 'string' ? param : ''
}

const summaryIds = new Set<number>()

function createEmptyMetadata(): FileMetadata {
  return {
    fanworkTitle: '',
    characters: [],
    location: '',
    locationName: '',
    latitude: null,
    longitude: null,
    cameraModel: '',
    lensModel: '',
    aperture: '',
    focalLength: '',
    iso: '',
    shutterSpeed: '',
    exposureBias: '',
    exposureProgram: '',
    exposureMode: '',
    meteringMode: '',
    whiteBalance: '',
    flash: '',
    colorSpace: '',
    resolutionX: '',
    resolutionY: '',
    resolutionUnit: '',
    software: '',
    captureTime: '',
    notes: '',
    fileSize: 0,
  }
}

function toFileResponseSummary(file: FileSummary): FileResponse {
  const imageUrl = file.imageUrl.trim()
  const metadata = createEmptyMetadata()
  const thumbhash = file.thumbhash?.trim()
  if (thumbhash) {
    metadata.thumbhash = thumbhash
  }
  const livePhotoVideoUrl = file.livePhotoVideoUrl?.trim()
  if (livePhotoVideoUrl) {
    metadata.livePhotoVideoUrl = livePhotoVideoUrl
  }
  return {
    id: file.id,
    title: '',
    description: '',
    originalName: '',
    imageUrl,
    width: file.width,
    height: file.height,
    metadata,
    fanworkTitle: '',
    location: '',
    cameraModel: '',
    characters: [],
    genre: '',
    series: [],
    fileSize: 0,
    createdAt: '',
  }
}

function hydrateSummaryFiles(nextBatch: FileSummary[]): FileResponse[] {
  return nextBatch.map((file) => {
    summaryIds.add(file.id)
    return toFileResponseSummary(file)
  })
}

const pageSize = 36
const { data, pending, error } = useFetch<FileSummary[]>('/api/files', {
  default: () => [],
  query: {
    limit: pageSize,
    offset: 0,
    waterfall: '1',
  },
  server: false,
})
const { data: seriesData, pending: pendingSeries, error: seriesError, refresh: refreshSeries } = useFetch<SeriesSummary[]>('/api/series', {
  default: () => [],
  server: false,
})

const { settings: siteSettingsState, load: loadSiteSettings } = useSiteSettingsState()

const siteSettings = computed<SiteSettings | null>(() => siteSettingsState.value)
const defaultTitle = computed(() => t('home.defaultTitle'))
const defaultDescription = computed(() => t('home.defaultDescription'))
const pageTitle = computed(() => {
  const name = siteSettings.value?.name?.trim()
  if (name && name.length > 0) {
    return name
  }
  return defaultTitle.value
})
const pageDescription = computed(() => {
  const description = siteSettings.value?.description?.trim()
  if (description && description.length > 0) {
    return description
  }
  return defaultDescription.value
})

const files = ref<FileResponse[]>([])
const totalFiles = computed(() => files.value.length)
const isLoadingMore = ref(false)
const loadMoreError = ref(false)
const nextOffset = ref(0)
const hasMore = ref(false)
const loadMoreSentinel = ref<HTMLElement | null>(null)
const loadMoreObserver = ref<IntersectionObserver | null>(null)
const showLoadMoreSentinel = computed(() => files.value.length > 0)
const isLoading = computed(() => pending.value || isLoadingMore.value)
const fetchError = computed(() => error.value)
const alertTitle = computed(() => fetchError.value?.message ?? t('home.fetchFailed'))
const alertDescription = computed(() => t('home.fetchFailedDescription'))
const emptyText = computed(() => t('home.emptyText'))
const scrollElementRef = ref<HTMLElement | undefined>()
const runtimeConfig = useRuntimeConfig()
const route = useRoute()
const seriesList = computed(() => seriesData.value ?? [])
const hasRealSeries = computed(() => seriesList.value.some(item => !item.isVirtual))
const isSeriesRoute = computed(() => route.path === '/series')
const showSeriesLanding = computed(() => {
  if (isSeriesRoute.value) {
    return true
  }
  return route.path === '/' && (pendingSeries.value || hasRealSeries.value)
})
const seriesErrorMessage = computed(() => seriesError.value?.message ?? null)

const routePhotoId = computed<number | null>(() => {
  const normalized = normalizeRouteParam(route.params.id)
  if (!normalized) {
    return null
  }
  const parsed = Number.parseInt(normalized, 10)
  if (!Number.isFinite(parsed)) {
    return null
  }
  const section = normalizeRouteParam(route.params.section)
  if (section) {
    return section === 'photo' ? parsed : null
  }
  if (route.path.startsWith('/photo/')) {
    return parsed
  }
  return null
})

function replaceFile(updated: FileResponse): void {
  const index = files.value.findIndex(file => file.id === updated.id)
  if (index === -1) {
    files.value = [...files.value, updated]
    return
  }
  const nextFiles = [...files.value]
  nextFiles[index] = updated
  files.value = nextFiles
}

function mergeFiles(nextBatch: FileResponse[]): void {
  if (nextBatch.length === 0) {
    return
  }
  const existingIds = new Set(files.value.map(file => file.id))
  const unique = nextBatch.filter(file => !existingIds.has(file.id))
  if (unique.length > 0) {
    files.value = [...files.value, ...unique]
  }
}

function mergeSummaryFiles(nextBatch: FileSummary[]): void {
  if (nextBatch.length === 0) {
    return
  }
  const existingIds = new Set(files.value.map(file => file.id))
  const unique = nextBatch.filter(file => !existingIds.has(file.id))
  if (unique.length === 0) {
    return
  }
  for (const file of unique) {
    summaryIds.add(file.id)
  }
  mergeFiles(unique.map(file => toFileResponseSummary(file)))
}

function syncInitialFiles(nextBatch: FileSummary[]): void {
  summaryIds.clear()
  files.value = hydrateSummaryFiles(nextBatch)
  nextOffset.value = nextBatch.length
  hasMore.value = nextBatch.length >= pageSize
}

async function ensureRouteFile(): Promise<void> {
  const targetId = routePhotoId.value
  if (!targetId) {
    return
  }
  const existing = files.value.find(file => file.id === targetId)
  if (existing && !summaryIds.has(targetId)) {
    return
  }
  try {
    const file = await $fetch<FileResponse>(`/api/files/${targetId}`)
    summaryIds.delete(file.id)
    replaceFile(file)
  }
  catch {
    // Ignore missing route data.
  }
}

if (import.meta.client) {
  void loadSiteSettings()
  watch(
    data,
    async (nextData) => {
      const resolved = Array.isArray(nextData) ? nextData : []
      syncInitialFiles(resolved)
      await nextTick()
      refreshLoadMoreObserver()
      void ensureRouteFile()
    },
    { immediate: true },
  )
  const ensuredRouteId = ref<number | null>(null)
  watch(
    [pending, routePhotoId],
    ([isPending, routeId]) => {
      if (isPending) {
        return
      }
      if (!routeId) {
        ensuredRouteId.value = null
        return
      }
      if (ensuredRouteId.value === routeId) {
        return
      }
      ensuredRouteId.value = routeId
      void ensureRouteFile()
    },
    { immediate: true },
  )
}

async function loadMore(): Promise<void> {
  if (isLoadingMore.value || pending.value || !hasMore.value || loadMoreError.value) {
    return
  }
  isLoadingMore.value = true
  try {
    const nextBatch = await $fetch<FileSummary[]>('/api/files', {
      query: {
        limit: pageSize,
        offset: nextOffset.value,
        waterfall: '1',
      },
    })
    if (nextBatch.length === 0) {
      hasMore.value = false
      return
    }
    mergeSummaryFiles(nextBatch)
    nextOffset.value += nextBatch.length
    if (nextBatch.length < pageSize) {
      hasMore.value = false
      refreshLoadMoreObserver()
      return
    }
    await nextTick()
    refreshLoadMoreObserver()
  }
  catch {
    loadMoreError.value = true
  }
  finally {
    isLoadingMore.value = false
  }
}

function setupLoadMoreObserver(): void {
  if (globalThis.window === undefined || !('IntersectionObserver' in globalThis)) {
    return
  }
  if (!loadMoreSentinel.value) {
    return
  }
  loadMoreObserver.value?.disconnect()
  loadMoreObserver.value = new IntersectionObserver(
    (entries) => {
      if (entries.some(entry => entry.isIntersecting)) {
        void loadMore()
      }
    },
    {
      root: scrollElementRef.value ?? null,
      rootMargin: '600px 0px',
      threshold: 0,
    },
  )
  loadMoreObserver.value.observe(loadMoreSentinel.value)
}

function refreshLoadMoreObserver(): void {
  loadMoreObserver.value?.disconnect()
  if (!hasMore.value || !showLoadMoreSentinel.value) {
    return
  }
  setupLoadMoreObserver()
}

const infoPlacement = computed<SiteInfoPlacement>(() => {
  const placement = siteSettings.value?.infoPlacement?.trim()
  if (placement === 'waterfall') {
    return 'waterfall'
  }
  return 'header'
})

const showHeaderInfo = computed(() => infoPlacement.value === 'header')

const headerSocialLinks = computed<SocialLink[]>(() => {
  const links: SocialLink[] = []
  const social = siteSettings.value?.social ?? runtimeConfig.public.social

  const appendLink = (label: string, url: string | undefined, icon: string): void => {
    const normalized = (url ?? '').trim()
    if (normalized.length > 0) {
      links.push({ label, url: normalized, icon })
    }
  }

  appendLink('Homepage', social?.homepage, 'tabler:home')
  appendLink('GitHub', social?.github, 'tabler:brand-github')
  appendLink('X', social?.twitter, 'tabler:brand-x')
  appendLink('Instagram', social?.instagram, 'tabler:brand-instagram')
  appendLink('YouTube', social?.youtube, 'tabler:brand-youtube')
  appendLink('TikTok', social?.tiktok, 'tabler:brand-tiktok')
  appendLink('Bilibili', social?.bilibili, 'tabler:brand-bilibili')
  appendLink('LinkedIn', social?.linkedin, 'tabler:brand-linkedin')
  appendLink('Weibo', social?.weibo, 'tabler:brand-weibo')
  return links
})

const { data: sessionState } = useFetch<SessionState>('/api/auth/session', {
  default: () => ({ authenticated: false }),
  server: false,
})

const isAuthenticated = computed(() => sessionState.value?.authenticated ?? false)

if (import.meta.client) {
  watch(
    showSeriesLanding,
    async (isLanding) => {
      if (!isLanding) {
        await nextTick()
        refreshLoadMoreObserver()
      }
    },
  )
}

onMounted(() => {
  const root = document.scrollingElement ?? document.documentElement ?? document.body ?? undefined
  if (root instanceof HTMLElement) {
    scrollElementRef.value = root
  }
  refreshLoadMoreObserver()
})

onBeforeUnmount(() => {
  loadMoreObserver.value?.disconnect()
})

usePageSeo({
  title: pageTitle,
  description: pageDescription,
})

defineOgImageComponent('LioraCard', {
  title: () => pageTitle.value,
  description: () => pageDescription.value,
  itemCount: () => totalFiles.value,
})
</script>

<template>
  <div class="home-display-font min-h-screen w-full">
    <GalleryHeaderBar
      :title="pageTitle"
      :social-links="headerSocialLinks"
      :show-header-info="showHeaderInfo"
      :is-authenticated="isAuthenticated"
    />
    <template v-if="showSeriesLanding">
      <section class="max-w-500 m-auto w-full px-3 py-4 md:px-4 md:py-6">
        <section class="space-y-4">
          <header class="space-y-1">
            <h2 class="text-2xl font-semibold text-highlighted">
              {{ t('series.list.title') }}
            </h2>
            <p class="text-sm text-muted">
              {{ t('series.list.description') }}
            </p>
          </header>
          <SeriesGrid
            :series-list="seriesList"
            :pending="pendingSeries"
            :error-message="seriesErrorMessage"
            @retry="refreshSeries"
          />
        </section>
      </section>
    </template>

    <div v-else class="max-w-500 m-auto">
      <UAlert
        v-if="fetchError"
        color="error"
        variant="soft"
        :title="alertTitle"
        :description="alertDescription"
      >
        <template #icon>
          <Icon name="tabler:alert-circle" class="h-5 w-5" />
        </template>
      </UAlert>

      <WaterfallGallery
        :files="files"
        :is-loading="isLoading"
        :site-settings="siteSettings ?? undefined"
        :scroll-element="scrollElementRef"
        :empty-text="emptyText"
        :is-authenticated="isAuthenticated"
      />
      <div
        v-show="showLoadMoreSentinel"
        ref="loadMoreSentinel"
        class="flex min-h-12 items-center justify-center gap-2 py-6 text-xs text-muted"
        aria-live="polite"
      >
        <template v-if="isLoadingMore">
          <Icon name="tabler:loader-2" class="h-4 w-4 animate-spin" />
          <span>{{ t('common.loading') }}</span>
        </template>
        <template v-else-if="loadMoreError">
          <span>{{ t('common.toast.loadFailed') }}</span>
          <UButton
            size="xs"
            variant="soft"
            color="neutral"
            icon="tabler:refresh"
            @click="loadMoreError = false; loadMore()"
          >
            {{ t('common.actions.retry') }}
          </UButton>
        </template>
      </div>
    </div>
    <div class="hidden">
      <slot />
    </div>
    <BackToTop />
  </div>
</template>
