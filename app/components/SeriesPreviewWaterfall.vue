<script setup lang="ts">
import type { FileSummary } from '~/types/file'
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { Waterfall } from 'vue-wf'

interface DisplaySize {
  width: number
  height: number
}

interface PreviewWaterfallEntry {
  id: number
  imageUrl: string
  requestWidth: number
  requestHeight: number
  displaySize: DisplaySize
}

const props = withDefaults(
  defineProps<{
    previews: FileSummary[]
    title: string
    columns?: number
    gap?: number
    fallbackText?: string
  }>(),
  {
    columns: 2,
    gap: 4,
    fallbackText: '',
  },
)

const containerRef = ref<HTMLElement | null>(null)
const wrapperWidth = ref(0)
const resizeObserver = ref<ResizeObserver | null>(null)

function normalizePositive(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 1
}

function updateWrapperWidth(): void {
  const measured = containerRef.value?.clientWidth ?? 0
  if (!Number.isFinite(measured) || measured <= 0) {
    return
  }
  wrapperWidth.value = Math.round(measured)
}

const fallbackWrapperWidth = computed(() => {
  return props.columns * 120 + (props.columns - 1) * props.gap
})

const resolvedWrapperWidth = computed(() => {
  if (wrapperWidth.value > 0) {
    return wrapperWidth.value
  }
  return fallbackWrapperWidth.value
})

const columnWidth = computed(() => {
  const available = resolvedWrapperWidth.value - props.gap * (props.columns - 1)
  const computedWidth = Math.floor(available / props.columns)
  return Math.max(1, computedWidth)
})

const previewEntries = computed<PreviewWaterfallEntry[]>(() => {
  return props.previews
    .filter(preview => typeof preview.imageUrl === 'string' && preview.imageUrl.trim().length > 0)
    .map((preview, index) => {
      const sourceWidth = normalizePositive(preview.width)
      const sourceHeight = normalizePositive(preview.height)
      const displayWidth = columnWidth.value
      const displayHeight = Math.max(1, Math.round((displayWidth * sourceHeight) / sourceWidth))
      return {
        id: preview.id || index,
        imageUrl: preview.imageUrl,
        requestWidth: displayWidth * 2,
        requestHeight: displayHeight * 2,
        displaySize: {
          width: displayWidth,
          height: displayHeight,
        },
      }
    })
})

const waterfallItems = computed<DisplaySize[]>(() => previewEntries.value.map(entry => entry.displaySize))

onMounted(async () => {
  await nextTick()
  updateWrapperWidth()
  if (typeof ResizeObserver === 'undefined') {
    return
  }
  resizeObserver.value = new ResizeObserver(() => updateWrapperWidth())
  if (containerRef.value) {
    resizeObserver.value.observe(containerRef.value)
  }
})

onBeforeUnmount(() => {
  resizeObserver.value?.disconnect()
})
</script>

<template>
  <div ref="containerRef" class="h-full w-full overflow-hidden">
    <div
      v-if="previewEntries.length === 0"
      class="flex h-full min-h-20 items-center justify-center rounded-sm bg-default/80 px-2 text-center text-xs text-muted"
    >
      {{ fallbackText }}
    </div>
    <Waterfall
      v-else
      :gap="gap"
      :range-expand="120"
      :cols="columns"
      :items="waterfallItems"
      :wrapper-width="resolvedWrapperWidth"
    >
      <template v-for="entry in previewEntries" :key="entry.id">
        <NuxtImg
          :src="entry.imageUrl"
          :alt="title"
          class="h-full w-full rounded-sm object-cover"
          :width="entry.requestWidth"
          :height="entry.requestHeight"
          :sizes="`${entry.displaySize.width}px`"
          fit="cover"
          format="webp"
          quality="72"
          loading="lazy"
        />
      </template>
    </Waterfall>
  </div>
</template>
