<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { thumbHashToApproximateAspectRatio, thumbHashToDataURL } from 'thumbhash';
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

type ThumbhashInfo = {
  dataUrl: string;
  aspectRatio: number;
};

type DisplaySize = {
  width: number;
  height: number;
};

type ResolvedFile = FileResponse & {
  coverUrl: string;
  placeholder?: string;
  placeholderAspectRatio?: number;
  displaySize: DisplaySize;
};

const toByteArrayFromBase64 = (value: string): Uint8Array => {
  if (typeof atob === 'function') {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(value, 'base64'));
  }
  throw new Error('No base64 decoder available.');
};

const decodeThumbhash = (value: string | undefined): ThumbhashInfo | undefined => {
  if (!value) {
    return undefined;
  }
  try {
    const bytes = toByteArrayFromBase64(value);
    const aspectRatio = thumbHashToApproximateAspectRatio(bytes);
    if (!Number.isFinite(aspectRatio) || aspectRatio <= 0) {
      return {
        dataUrl: thumbHashToDataURL(bytes),
        aspectRatio: 1,
      };
    }
    return {
      dataUrl: thumbHashToDataURL(bytes),
      aspectRatio,
    };
  } catch (error) {
    console.warn('Failed to decode thumbhash', error);
    return undefined;
  }
};

const toTimestamp = (value: string | undefined): number | null => {
  if (!value) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const resolveSortTimestamp = (file: FileResponse): number => {
  const captureTimestamp = toTimestamp(file.metadata.captureTime);
  const createdTimestamp = toTimestamp(file.createdAt) ?? 0;
  return captureTimestamp ?? createdTimestamp;
};

const computeDisplaySize = (file: FileResponse, aspectRatio?: number): DisplaySize => {
  const width = file.width > 0 ? Math.min(file.width, maxDisplayWidth) : maxDisplayWidth;
  const ratio =
    aspectRatio && Number.isFinite(aspectRatio) && aspectRatio > 0
      ? aspectRatio
      : file.width > 0 && file.height > 0
        ? file.width / file.height
        : 1;
  const height = Math.round(width / ratio);
  return { width, height };
};

const resolvedFiles = computed<ResolvedFile[]>(() =>
  [...props.files]
    .map((file) => {
      const decoded = decodeThumbhash(file.metadata.thumbhash);
      const displaySize = computeDisplaySize(file, decoded?.aspectRatio);
      return {
        ...file,
        coverUrl: file.thumbnailUrl?.trim() || file.imageUrl,
        placeholder: decoded?.dataUrl,
        placeholderAspectRatio: decoded?.aspectRatio,
        displaySize,
      };
    })
    .sort((first, second) => resolveSortTimestamp(second) - resolveSortTimestamp(first))
);

const waterfallItems = computed(() => resolvedFiles.value.map((file) => file.displaySize));
const isPriorityIndex = (index: number): boolean => index === 0;

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
          v-for="(file, index) in resolvedFiles"
          :key="file.id"
          :style="{ aspectRatio: `${file.displaySize.width} / ${file.displaySize.height}` }"
        >
          <NuxtImg
            :src="file.coverUrl"
            :alt="file.title"
            :width="file.displaySize.width"
            :height="file.displaySize.height"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 400px"
            format="webp"
            fit="cover"
            :loading="isPriorityIndex(index) ? 'eager' : 'lazy'"
            :fetchpriority="isPriorityIndex(index) ? 'high' : 'auto'"
            :preload="isPriorityIndex(index)"
            :placeholder="file.placeholder"
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
