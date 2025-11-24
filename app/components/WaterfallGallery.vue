<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { Waterfall } from 'vue-wf';
import type { FileResponse } from '~/types/file';

const props = withDefaults(
  defineProps<{
    files: FileResponse[];
    isLoading: boolean;
    emptyText?: string;
  }>(),
  {
    emptyText: '暂无数据',
  }
);

const galleryRef = ref<HTMLElement | null>(null);
const columns = ref(5);

const maxDisplayWidth = 400;

const resolvedFiles = computed<Array<FileResponse & { coverUrl: string }>>(() =>
  props.files.map((file) => ({
    ...file,
    coverUrl: file.thumbnailUrl?.trim() || file.imageUrl,
  }))
);

const computeDisplaySize = (file: FileResponse): { width: number; height: number } => {
  const width = file.width > 0 ? Math.min(file.width, maxDisplayWidth) : maxDisplayWidth;
  const height =
    file.width > 0 && file.height > 0 ? Math.round((file.height / file.width) * width) : maxDisplayWidth;
  return { width, height };
};

const waterfallItems = computed(() =>
  resolvedFiles.value.map((file) => {
    const size = computeDisplaySize(file);
    return { width: size.width, height: size.height };
  })
);

const updateColumns = (): void => {
  if (typeof window === 'undefined') {
    return;
  }
  const width = galleryRef.value?.clientWidth ?? window.innerWidth;
  if (!Number.isFinite(width) || width <= 0) {
    return;
  }
  const target = Math.max(1, Math.ceil(width / maxDisplayWidth));
  columns.value = target;
};

onMounted(() => {
  updateColumns();
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', updateColumns, { passive: true });
  }
});

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', updateColumns);
  }
});

</script>

<template>
  <div ref="galleryRef" class="relative">
    <div v-if="!resolvedFiles.length && !isLoading" class="flex h-full items-center justify-center px-4 py-12 text-sm">
      {{ emptyText }}
    </div>
    <div v-else class="overflow-hidden">
      <Waterfall
        :gap="4"
        :cols="columns"
        :items="waterfallItems"
      >
        <div
          v-for="file in resolvedFiles"
          :key="file.id"
        >
          <NuxtImg
            :src="file.coverUrl"
            :alt="file.title || file.fanworkTitle || '作品预览'"
            :width="computeDisplaySize(file).width"
            :height="computeDisplaySize(file).height"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 400px"
            format="webp"
            fit="cover"
            loading="lazy"
            class="h-full w-full object-cover"
          />
        </div>
      </Waterfall>
    </div>
    <div v-if="isLoading" class="absolute inset-0 flex items-center justify-center backdrop-blur-sm">
      <span class="text-sm">加载中…</span>
    </div>
  </div>
</template>
