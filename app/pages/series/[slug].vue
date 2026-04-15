<script setup lang="ts">
import type { SessionState } from '~/types/auth'
import type { FileMetadata, FileResponse, FileSummary } from '~/types/file'
import type { SocialLink } from '~/types/gallery'
import type { SeriesDetail } from '~/types/series'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useSiteSettingsState } from '~/composables/useSiteSettings'

function normalizeRouteParam(param: string | string[] | null | undefined): string {
  if (Array.isArray(param)) {
    return param.find((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0) ?? ''
  }
  return typeof param === 'string' ? param : ''
}

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

definePageMeta({
  path: String.raw`/series/:slug/:section(photo)?/:id(\d+)?`,
  validate: (route) => {
    const slug = normalizeRouteParam(route.params.slug)
    if (!slug) {
      return false
    }
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

const { t } = useI18n()
const route = useRoute()
const runtimeConfig = useRuntimeConfig()

const pageSize = 36
const summaryIds = new Set<number>()

const slug = computed(() => normalizeRouteParam(route.params.slug))
const overlayRootPath = computed(() => `/series/${slug.value}`)
const overlayBasePath = computed(() => `/series/${slug.value}/photo`)

const { data, pending, error } = useFetch<SeriesDetail>(() => `/api/series/by-slug/${encodeURIComponent(slug.value)}`, {
  query: {
    limit: pageSize,
    offset: 0,
  },
  server: false,
  watch: [slug],
})

const { settings: siteSettingsState, load: loadSiteSettings } = useSiteSettingsState()

const files = ref<FileResponse[]>([])
const seriesDetail = ref<SeriesDetail | null>(null)
const isLoadingMore = ref(false)
const loadMoreError = ref(false)
const nextOffset = ref(0)
const hasMore = ref(false)
const loadMoreSentinel = ref<HTMLElement | null>(null)
const loadMoreObserver = ref<IntersectionObserver | null>(null)
const scrollElementRef = ref<HTMLElement | undefined>()

const siteSettings = computed(() => siteSettingsState.value)
const showHeaderInfo = computed(() => {
  const placement = siteSettings.value?.infoPlacement?.trim()
  return placement !== 'waterfall'
})
const pageHeaderTitle = computed(() => {
  const name = siteSettings.value?.name?.trim()
  if (name && name.length > 0) {
    return name
  }
  return t('home.defaultTitle')
})
const headerSocialLinks = computed<SocialLink[]>(() => {
  const links: SocialLink[] = []
  const social = siteSettings.value?.social ?? runtimeConfig.public.social

  const appendLink = (label: string, url: string | undefined, icon: string): void => {
    const trimmed = (url ?? '').trim()
    if (trimmed.length > 0) {
      links.push({ label, url: trimmed, icon })
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
const isLoading = computed(() => pending.value || isLoadingMore.value)
const showLoadMoreSentinel = computed(() => files.value.length > 0)
const showSeriesHeaderSkeleton = computed(() => pending.value && !seriesDetail.value)
const displaySeriesTitle = computed(() => {
  const current = seriesDetail.value
  if (!current) {
    return t('series.detail.titleFallback')
  }
  if (current.slug === '__uncategorized__') {
    return t('series.special.uncategorizedTitle')
  }
  return current.title || t('series.detail.titleFallback')
})
const displaySeriesDescription = computed(() => {
  const current = seriesDetail.value
  if (!current) {
    return t('series.detail.descriptionFallback')
  }
  if (current.slug === '__uncategorized__') {
    return t('series.special.uncategorizedDescription')
  }
  return current.description || t('series.detail.descriptionFallback')
})
const pageTitle = computed(() => {
  return `${displaySeriesTitle.value} | ${t('series.detail.seoTitle')}`
})
const pageDescription = computed(() => displaySeriesDescription.value || t('series.detail.seoDescription'))
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
  if (section !== 'photo') {
    return null
  }
  return parsed
})

const { data: sessionState } = useFetch<SessionState>('/api/auth/session', {
  default: () => ({ authenticated: false }),
  server: false,
})

const isAuthenticated = computed(() => sessionState.value?.authenticated ?? false)

useSeoMeta({
  title: () => pageTitle.value,
  ogTitle: () => pageTitle.value,
  description: () => pageDescription.value,
  ogDescription: () => pageDescription.value,
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
  files.value = [...files.value, ...unique.map(file => toFileResponseSummary(file))]
}

function syncInitialFiles(payload: SeriesDetail | null): void {
  summaryIds.clear()
  const entries = payload?.files ?? []
  for (const item of entries) {
    summaryIds.add(item.id)
  }
  files.value = entries.map(file => toFileResponseSummary(file))
  nextOffset.value = entries.length
  hasMore.value = entries.length >= pageSize
  loadMoreError.value = false
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

async function loadMore(): Promise<void> {
  if (isLoadingMore.value || pending.value || !hasMore.value || loadMoreError.value) {
    return
  }
  isLoadingMore.value = true
  try {
    const nextData = await $fetch<SeriesDetail>(`/api/series/by-slug/${encodeURIComponent(slug.value)}`, {
      query: {
        limit: pageSize,
        offset: nextOffset.value,
      },
    })
    seriesDetail.value = nextData
    if (nextData.files.length === 0) {
      hasMore.value = false
      refreshLoadMoreObserver()
      return
    }
    mergeSummaryFiles(nextData.files)
    nextOffset.value += nextData.files.length
    if (nextData.files.length < pageSize) {
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

watch(
  data,
  async (nextData) => {
    seriesDetail.value = nextData ?? null
    syncInitialFiles(nextData ?? null)
    await nextTick()
    refreshLoadMoreObserver()
    void ensureRouteFile()
  },
  { immediate: true },
)

watch(
  [pending, routePhotoId],
  ([isPending, routeId]) => {
    if (isPending || !routeId) {
      return
    }
    void ensureRouteFile()
  },
  { immediate: true },
)

onMounted(() => {
  const root = document.scrollingElement ?? document.documentElement ?? document.body ?? undefined
  if (root instanceof HTMLElement) {
    scrollElementRef.value = root
  }
  void loadSiteSettings()
  refreshLoadMoreObserver()
})

onBeforeUnmount(() => {
  loadMoreObserver.value?.disconnect()
})
</script>

<template>
  <div class="min-h-screen">
    <GalleryHeaderBar
      :title="pageHeaderTitle"
      :social-links="headerSocialLinks"
      :show-header-info="showHeaderInfo"
      :is-authenticated="isAuthenticated"
    />
    <div class="max-w-500 m-auto space-y-6 px-3 py-8 md:px-4">
      <header class="flex flex-wrap items-center justify-between gap-3">
        <div class="space-y-1">
          <template v-if="showSeriesHeaderSkeleton">
            <div class="space-y-2 py-1" aria-hidden="true">
              <USkeleton class="h-8 w-48" />
              <USkeleton class="h-4 w-80 max-w-[80vw]" />
              <USkeleton class="h-3 w-20" />
            </div>
            <span class="sr-only">{{ t('common.loading') }}</span>
          </template>
          <template v-else>
            <h1 class="text-2xl font-semibold text-highlighted">
              {{ displaySeriesTitle }}
            </h1>
            <p class="text-sm text-muted">
              {{ displaySeriesDescription }}
            </p>
            <p class="text-xs text-muted">
              {{ t('series.list.count', { count: seriesDetail?.fileCount ?? files.length }) }}
            </p>
          </template>
        </div>
        <div class="flex items-center gap-2">
          <UButton to="/" variant="soft" color="neutral" icon="tabler:home">
            {{ t('series.common.backHome') }}
          </UButton>
        </div>
      </header>

      <UAlert
        v-if="error"
        color="error"
        variant="soft"
        :title="t('series.detail.loadFailed')"
        :description="error.message"
      />

      <WaterfallGallery
        :files="files"
        :is-loading="isLoading"
        :is-authenticated="isAuthenticated"
        :site-settings="siteSettings ?? undefined"
        :scroll-element="scrollElementRef"
        :empty-text="t('series.detail.empty')"
        :total-count="seriesDetail?.fileCount ?? null"
        :overlay-root-path="overlayRootPath"
        :overlay-base-path="overlayBasePath"
        overlay-route-param="id"
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
    <BackToTop />
  </div>
</template>
