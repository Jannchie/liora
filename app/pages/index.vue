<script setup lang="ts">
import type { SessionState } from '~/types/auth'
import type { FileResponse } from '~/types/file'
import type { SiteSettings } from '~/types/site'
import { defineOgImageComponent } from '#imports'
import { computed, onMounted, ref } from 'vue'
import { useSiteSettingsState } from '~/composables/useSiteSettings'

const { t } = useI18n()

const { data, pending, error } = await useFetch<FileResponse[]>('/api/files', {
  default: () => [],
})

const { settings: siteSettingsState, load: loadSiteSettings } = useSiteSettingsState()
await loadSiteSettings()

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

const files = computed<FileResponse[]>(() => data.value ?? [])
const totalFiles = computed(() => files.value.length)
const isLoading = computed(() => pending.value)
const fetchError = computed(() => error.value)
const alertTitle = computed(() => fetchError.value?.message ?? t('home.fetchFailed'))
const alertDescription = computed(() => t('home.fetchFailedDescription'))
const emptyText = computed(() => t('home.emptyText'))
const loadingText = computed(() => t('home.loading'))
const scrollElementRef = ref<HTMLElement | undefined>()

const { data: sessionState } = await useFetch<SessionState>('/api/auth/session', {
  default: () => ({ authenticated: false }),
})

const isAuthenticated = computed(() => sessionState.value?.authenticated ?? false)

onMounted(() => {
  const root = document.scrollingElement ?? document.documentElement ?? document.body ?? undefined
  if (root instanceof HTMLElement) {
    scrollElementRef.value = root
  }
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
    <div class="max-w-[2000px] m-auto">
      <div class="flex items-center justify-end gap-2 p-4">
        <UButton
          v-if="isAuthenticated"
          to="/admin"
          color="primary"
          variant="soft"
          size="sm"
          class="shrink-0"
        >
          <span class="flex items-center gap-1 text-sm font-semibold">
            <Icon name="mdi:shield-check-outline" class="h-4 w-4" />
            <span>{{ t('admin.nav.label') }}</span>
          </span>
        </UButton>
        <LanguageSwitcher />
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

      <ClientOnly>
        <WaterfallGallery
          :files="files"
          :is-loading="isLoading"
          :site-settings="siteSettings ?? undefined"
          :scroll-element="scrollElementRef"
          :empty-text="emptyText"
          :is-authenticated="isAuthenticated"
        />
        <template #fallback>
          <div class="flex h-[50vh] items-center justify-center gap-2 text-sm text-muted">
            <Icon name="line-md:loading-loop" class="h-5 w-5 text-primary" />
            <span>{{ loadingText }}</span>
          </div>
        </template>
      </ClientOnly>
    </div>
  </div>
</template>
