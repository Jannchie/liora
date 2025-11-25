<script setup lang="ts">
import type { FileResponse } from '~/types/file'
import type { SiteSettings } from '~/types/site'
import { defineOgImageComponent } from '#imports'
import { computed, ref } from 'vue'
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
const scrollContainerRef = ref<HTMLDivElement | undefined>(undefined)
const alertTitle = computed(() => fetchError.value?.message ?? t('home.fetchFailed'))
const alertDescription = computed(() => t('home.fetchFailedDescription'))
const emptyText = computed(() => t('home.emptyText'))
const loadingText = computed(() => t('home.loading'))

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
  <div ref="scrollContainerRef" class="home-display-font h-screen w-screen overflow-auto">
    <div class="max-w-[2000px] m-auto">
      <div class="flex justify-end p-4">
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
          :scroll-element="scrollContainerRef"
          :empty-text="emptyText"
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
