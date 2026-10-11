<script setup lang="ts">
import type { HistogramData } from '~/types/file'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { drawHistogram } from '~/utils/histogram-render'

interface HistogramSummary {
  shadows: number
  midtones: number
  highlights: number
}

const props = defineProps<{
  histogram: HistogramData | null
}>()

const { t } = useI18n()

const histogramCanvasRef = ref<HTMLCanvasElement | null>(null)
let resizeObserver: ResizeObserver | null = null

const histogramSummary = computed<HistogramSummary | null>(() => {
  const value = props.histogram
  if (!value) {
    return null
  }
  let total = 0
  for (const entry of value.luminance) {
    if (Number.isFinite(entry)) {
      total += entry
    }
  }
  if (total <= 0) {
    return null
  }
  const sumRange = (start: number, end: number): number => {
    let sum = 0
    for (let index = start; index <= end; index += 1) {
      sum += value.luminance[index] ?? 0
    }
    return sum
  }
  const share = (start: number, end: number): number =>
    Math.round(Math.max(0, Math.min(1, sumRange(start, end) / total)) * 100)
  return {
    shadows: share(0, 63),
    midtones: share(64, 191),
    highlights: share(192, 255),
  }
})

// Drawn straight onto a 2D canvas at device resolution, the way LLR draws
// its rail histogram; a ResizeObserver redraws when the column changes width.
function render(): void {
  const canvas = histogramCanvasRef.value
  const histogram = props.histogram
  if (!canvas || !histogram) {
    return
  }
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  if (width <= 0 || height <= 0) {
    return
  }
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return
  }
  const dpr = globalThis.devicePixelRatio || 1
  const backingWidth = Math.round(width * dpr)
  const backingHeight = Math.round(height * dpr)
  if (canvas.width !== backingWidth) {
    canvas.width = backingWidth
  }
  if (canvas.height !== backingHeight) {
    canvas.height = backingHeight
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  drawHistogram(ctx, width, height, histogram)
}

watch(() => props.histogram, render, { flush: 'post' })

// A GPU reset drops every canvas's backing store; the browser restores the
// context empty, so draw again instead of leaving a blank plate.
watch(histogramCanvasRef, (canvas, previous) => {
  resizeObserver?.disconnect()
  resizeObserver = null
  previous?.removeEventListener('contextrestored', render)
  if (canvas) {
    canvas.addEventListener('contextrestored', render)
    // The observer's first callback is also the first draw.
    if (typeof ResizeObserver === 'undefined') {
      render()
    }
    else {
      resizeObserver = new ResizeObserver(() => render())
      resizeObserver.observe(canvas)
    }
  }
}, { flush: 'post' })

onBeforeUnmount(() => {
  histogramCanvasRef.value?.removeEventListener('contextrestored', render)
  resizeObserver?.disconnect()
  resizeObserver = null
})
</script>

<template>
  <!--
    A section of the viewer's info column: caption, then the plot bare
    across the column's full width as in LLR's rail (always on its dark
    stage — the additive colours need a black ground), then the tonal
    split as three cells sharing hairlines.
  -->
  <section class="border-b border-border">
    <p class="label-caption flex items-center gap-1.5 px-5 pb-3 pt-4 text-dimmed">
      <Icon name="jannchie:chart-line" class="h-3.5 w-3.5 shrink-0" />
      <span class="leading-none">{{ t('gallery.histogram.title') }}</span>
    </p>
    <div class="relative h-20 w-full border-t border-border bg-[#0c0c0c]">
      <canvas ref="histogramCanvasRef" class="absolute inset-0 block h-full w-full" />
      <div
        v-if="!histogram"
        class="absolute inset-0 flex items-center justify-center gap-2 text-xs text-white/60"
      >
        <Icon name="jannchie:loader" class="h-4 w-4 animate-spin" />
        <span>{{ t('gallery.histogram.pending') }}</span>
      </div>
    </div>
    <div v-if="histogramSummary" class="grid grid-cols-3 divide-x divide-border border-t border-border">
      <div class="space-y-2 px-3 py-3">
        <div class="flex items-baseline justify-between gap-2">
          <span class="label-caption-sm truncate text-dimmed">{{ t('gallery.histogram.shadows') }}</span>
          <span class="font-mono text-xs text-highlighted">{{ histogramSummary.shadows }}%</span>
        </div>
        <div class="h-0.5 w-full overflow-hidden rounded-[1px] bg-border-strong">
          <div class="h-full bg-primary" :style="{ width: `${histogramSummary.shadows}%` }" />
        </div>
      </div>
      <div class="space-y-2 px-3 py-3">
        <div class="flex items-baseline justify-between gap-2">
          <span class="label-caption-sm truncate text-dimmed">{{ t('gallery.histogram.midtones') }}</span>
          <span class="font-mono text-xs text-highlighted">{{ histogramSummary.midtones }}%</span>
        </div>
        <div class="h-0.5 w-full overflow-hidden rounded-[1px] bg-border-strong">
          <div class="h-full bg-primary" :style="{ width: `${histogramSummary.midtones}%` }" />
        </div>
      </div>
      <div class="space-y-2 px-3 py-3">
        <div class="flex items-baseline justify-between gap-2">
          <span class="label-caption-sm truncate text-dimmed">{{ t('gallery.histogram.highlights') }}</span>
          <span class="font-mono text-xs text-highlighted">{{ histogramSummary.highlights }}%</span>
        </div>
        <div class="h-0.5 w-full overflow-hidden rounded-[1px] bg-border-strong">
          <div class="h-full bg-primary" :style="{ width: `${histogramSummary.highlights}%` }" />
        </div>
      </div>
    </div>
  </section>
</template>
