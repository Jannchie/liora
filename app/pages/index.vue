<script setup lang="ts">
import type { FileResponse } from '~/types/file'
import { computed, ref } from 'vue'

const { data, pending, error } = await useFetch<FileResponse[]>('/api/files', {
  default: () => [],
})

const pageTitle = 'Gallery | Liora'
const pageDescription = '展示摄影与插画作品的瀑布流画廊。'

useSeoMeta({
  title: pageTitle,
  ogTitle: pageTitle,
  description: pageDescription,
  ogDescription: pageDescription,
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
