<script setup lang="ts">
import type { SessionState } from '~/types/auth'
import type { FileMetadata, FileResponse, FileSummary } from '~/types/file'
import type { SiteInfoPlacement, SocialLink } from '~/types/gallery'
import type { SiteSettings } from '~/types/site'
import { defineOgImageComponent } from '#imports'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
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
  return {
    id: file.id,
    title: '',
    description: '',
    originalName: '',
    imageUrl,
    width: file.width,
    height: file.height,
    metadata: createEmptyMetadata(),
    fanworkTitle: '',
    location: '',
    cameraModel: '',
    characters: [],
    genre: '',
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

const routePhotoId = computed<number | null>(() => {
  const section = normalizeRouteParam(route.params.section)
  if (section !== 'photo') {
    return null
  }
  const normalized = normalizeRouteParam(route.params.id)
  if (!normalized) {
    return null
  }
  const parsed = Number.parseInt(normalized, 10)
  return Number.isFinite(parsed) ? parsed : null
})

function replaceFile(updated: FileResponse): void {
  const index = files.value.findIndex(file => file.id === updated.id)
  if (index < 0) {
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
    (nextData) => {
      const resolved = Array.isArray(nextData) ? nextData : []
      syncInitialFiles(resolved)
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
    }
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

  appendLink('Homepage', social?.homepage, 'mdi:home')
  appendLink('GitHub', social?.github, 'mdi:github')
  appendLink('X', social?.twitter, 'fa6-brands:x-twitter')
  appendLink('Instagram', social?.instagram, 'mdi:instagram')
  appendLink('YouTube', social?.youtube, 'mdi:youtube')
  appendLink('TikTok', social?.tiktok, 'fa6-brands:tiktok')
  appendLink('Bilibili', social?.bilibili, 'simple-icons:bilibili')
  appendLink('LinkedIn', social?.linkedin, 'mdi:linkedin')
  appendLink('Weibo', social?.weibo, 'mdi:sina-weibo')
  return links
})

const { data: sessionState } = useFetch<SessionState>('/api/auth/session', {
  default: () => ({ authenticated: false }),
  server: false,
})

const isAuthenticated = computed(() => sessionState.value?.authenticated ?? false)

onMounted(() => {
  const root = document.scrollingElement ?? document.documentElement ?? document.body ?? undefined
  if (root instanceof HTMLElement) {
    scrollElementRef.value = root
  }
  setupLoadMoreObserver()
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
    <header
      v-if="showHeaderInfo"
      class="sticky inset-x-0 top-0 z-30 w-full border-b border-default/20 bg-default"
    >
      <div class="mx-auto flex w-full flex-col items-center gap-2 px-3 py-2 text-center md:max-w-500 md:flex-row md:items-center md:justify-between md:gap-3 md:px-4 md:py-3 md:text-left">
        <div class="flex w-full flex-col items-center gap-1 md:flex-1 md:flex-row md:items-center md:gap-3">
          <h1 class="home-title-font text-sm font-semibold leading-tight text-highlighted md:text-lg">
            {{ pageTitle }}
          </h1>
          <div class="flex flex-wrap items-center justify-center gap-2 text-muted md:justify-start">
            <UButton
              v-for="link in headerSocialLinks"
              :key="link.label"
              :href="link.url"
              target="_blank"
              rel="noopener noreferrer"
              variant="soft"
              color="neutral"
              square
              size="sm"
              class="text-muted"
              :icon="link.icon"
              :aria-label="link.label"
            />
          </div>
        </div>
        <div class="flex items-center gap-2 md:shrink-0">
          <UButton
            v-if="isAuthenticated"
            to="/admin"
            color="primary"
            variant="soft"
            size="sm"
            icon="mdi:shield-check-outline"
            class="shrink-0"
          >
            {{ t('admin.nav.label') }}
          </UButton>
          <LanguageSwitcher class="hidden md:block" />
        </div>
      </div>
    </header>
    <div class="max-w-500 m-auto">
      <div
        v-if="!showHeaderInfo"
        class="mx-auto flex flex-wrap items-center justify-end gap-2 px-3 py-2 md:max-w-500 md:flex-nowrap md:gap-3 md:px-4 md:py-3"
      >
        <UButton
          v-if="isAuthenticated"
          to="/admin"
          color="primary"
          variant="soft"
          size="sm"
          class="shrink-0"
          icon="mdi:shield-check-outline"
        >
          {{ t('admin.nav.label') }}
        </UButton>
        <LanguageSwitcher class="hidden md:block" />
      </div>
      <UAlert
        v-if="fetchError"
        color="error"
        variant="soft"
        :title="alertTitle"
        :description="alertDescription"
      >
        <template #icon>
          <Icon name="mdi:alert-circle-outline" class="h-5 w-5" />
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
        class="flex min-h-12 items-center justify-center py-6 text-xs text-muted"
        aria-live="polite"
      >
        <span v-if="isLoadingMore">{{ t('common.loading') }}</span>
        <span v-else-if="loadMoreError">{{ t('common.toast.loadFailed') }}</span>
      </div>
    </div>
    <div class="hidden">
      <slot />
    </div>
  </div>
</template>
