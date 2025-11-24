<script setup lang="ts">
import { computed } from 'vue';
import type { FileResponse } from '~/types/file';

const { data, pending, error, refresh } = await useFetch<FileResponse[]>('/api/files', {
  default: () => [],
});

const files = computed<FileResponse[]>(() => data.value ?? []);
const isLoading = computed(() => pending.value);
const fetchError = computed(() => error.value);

const handleRefresh = async (): Promise<void> => {
  await refresh();
};
</script>

<template>
  <div class="min-h-screen">
    <UContainer class="space-y-6 py-10 max-w-[2000px]">
      <header class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="text-sm">作品瀑布流</p>
          <h1 class="text-3xl font-semibold">Gallery</h1>
          <p class="text-sm">
            主页只展示图片瀑布流，录入与管理请前往后台。
          </p>
        </div>
        <div class="flex items-center gap-2">
          <UButton to="/admin" variant="soft" color="primary" icon="i-heroicons-cog-6-tooth">
            后台
          </UButton>
          <UButton color="primary" variant="solid" :loading="isLoading" icon="i-heroicons-arrow-path" @click="handleRefresh">
            刷新
          </UButton>
        </div>
      </header>

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
