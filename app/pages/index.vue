<script setup lang="ts">
import type { FileResponse } from '~/types/file'
import type { SiteSettings } from '~/types/site'
import { computed, ref } from 'vue'

const { data, pending, error } = await useFetch<FileResponse[]>('/api/files', {
  default: () => [],
})
const { data: siteSettingsData } = await useFetch<SiteSettings | null>('/api/site', {
  default: () => null,
})

const siteSettings = computed<SiteSettings | null>(() => siteSettingsData.value ?? null)
const pageTitle = computed(() => {
  const name = siteSettings.value?.name?.trim()
  if (name && name.length > 0) {
    return name
  }
  return 'Liora Gallery'
})
const pageDescription = computed(() => {
  const description = siteSettings.value?.description?.trim()
  if (description && description.length > 0) {
    return description
  }
  return '展示摄影与插画作品的瀑布流画廊。'
})

useSeoMeta({
  title: () => pageTitle.value,
  ogTitle: () => pageTitle.value,
  description: () => pageDescription.value,
  ogDescription: () => pageDescription.value,
  twitterCard: 'summary_large_image',
})

const files = computed<FileResponse[]>(() => data.value ?? [])
const isLoading = computed(() => pending.value)
const fetchError = computed(() => error.value)
const scrollContainerRef = ref<HTMLDivElement | undefined>(undefined)
</script>

<template>
  <div ref="scrollContainerRef" class="h-screen w-screen overflow-auto">
    <div class="max-w-[2000px] m-auto">
      <UAlert
        v-if="fetchError"
        color="error"
        variant="soft"
        :title="fetchError?.message ?? '加载失败'"
        description="无法加载数据，请稍后重试。"
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
          empty-text="还没有作品，去后台录入吧。"
        />
        <template #fallback>
          <div class="flex h-[50vh] items-center justify-center gap-2 text-sm text-gray-500">
            <Icon name="line-md:loading-loop" class="h-5 w-5 text-primary" />
            <span>画廊加载中…</span>
          </div>
        </template>
      </ClientOnly>
    </div>
  </div>
</template>
