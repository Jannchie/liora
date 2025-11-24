<script setup lang="ts">
import { computed } from 'vue';
import type { FileResponse } from '~/types/file';

const { data, pending, error } = await useFetch<FileResponse[]>('/api/files', {
  default: () => [],
});

const pageTitle = 'Gallery | Liora';
const pageDescription = '展示摄影与插画作品的瀑布流画廊。';

useSeoMeta({
  title: pageTitle,
  ogTitle: pageTitle,
  description: pageDescription,
  ogDescription: pageDescription,
  twitterCard: 'summary_large_image',
});

const files = computed<FileResponse[]>(() => data.value ?? []);
const isLoading = computed(() => pending.value);
const fetchError = computed(() => error.value);
</script>

<template>
  <div class="min-h-screen">
    <UContainer class="space-y-6 py-10 max-w-[2000px]">
      <UAlert
        v-if="fetchError"
        color="error"
        variant="soft"
        :title="fetchError?.message ?? '加载失败'"
        description="无法加载数据，请稍后重试。"
      />

      <WaterfallGallery :files="files" :is-loading="isLoading" empty-text="还没有作品，去后台录入吧。" />
    </UContainer>
  </div>
</template>
