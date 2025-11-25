<script setup lang="ts">
import type { HistogramData } from '~/types/file'
import { Chart } from 'chart.js/auto'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

interface HistogramSummary {
  shadows: number
  midtones: number
  highlights: number
  peakChannel: HistogramChannel
  peakIndex: number
  monochrome: boolean
}

type HistogramChannel = 'red' | 'green' | 'blue' | 'luminance'

const props = defineProps<{
  histogram: HistogramData | null
}>()

const histogramSmoothingKernel = [1, 6, 15, 20, 15, 6, 1]

const { t } = useI18n()

const histogramCanvasRef = ref<HTMLCanvasElement | null>(null)
const histogramChart = ref<Chart | null>(null)

const histogramColors = computed(() => ({
  red: getCssColor('--ui-color-error-500', '#ef4444'),
  green: getCssColor('--ui-color-success-500', '#22c55e'),
  blue: getCssColor('--ui-color-info-500', '#3b82f6'),
}))

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
  const shadows = Math.max(0, Math.min(1, sumRange(0, 63) / total))
  const midtones = Math.max(0, Math.min(1, sumRange(64, 191) / total))
  const highlights = Math.max(0, Math.min(1, sumRange(192, 255) / total))
  const channels: Array<{ key: HistogramChannel, values: number[] }> = [
    { key: 'luminance', values: value.luminance },
    { key: 'red', values: value.red },
    { key: 'green', values: value.green },
    { key: 'blue', values: value.blue },
  ]
  let peak: { key: HistogramChannel, value: number, index: number } = { key: 'luminance', value: 0, index: 0 }
  for (const channel of channels) {
    for (let index = 0; index < channel.values.length; index += 1) {
      const current = channel.values[index] ?? 0
      if (current > peak.value) {
        peak = { key: channel.key, value: current, index }
      }
    }
  }
  return {
    shadows: Math.round(shadows * 100),
    midtones: Math.round(midtones * 100),
    highlights: Math.round(highlights * 100),
    peakChannel: peak.key,
    peakIndex: peak.index,
    monochrome: isMonochromeHistogram(value),
  }
})

watch(
  [
    () => props.histogram,
    histogramCanvasRef,
    histogramColors,
  ],
  () => {
    renderHistogram()
  },
  { flush: 'post' },
)

onMounted(() => {
  renderHistogram()
})

onBeforeUnmount(() => {
  destroyHistogramChart()
})

function getCssColor(name: string, fallback: string): string {
  if (globalThis.document !== undefined) {
    const value = getComputedStyle(globalThis.document.documentElement).getPropertyValue(name).trim()
    if (value.length > 0) {
      return value
    }
  }
  return fallback
}

function smoothHistogramChannel(values: number[], kernel: number[]): number[] {
  const result = Array.from({ length: values.length }, () => 0)
  const radius = Math.floor(kernel.length / 2)
  const defaultWeight = kernel.reduce((sum, weight) => sum + weight, 0)
  for (let index = 0; index < values.length; index += 1) {
    let accumulator = 0
    let weightSum = 0
    for (let offset = -radius; offset <= radius; offset += 1) {
      const kernelIndex = offset + radius
      const weight = kernel[kernelIndex] ?? 0
      if (weight <= 0) {
        continue
      }
      const valueIndex = index + offset
      if (valueIndex < 0 || valueIndex >= values.length) {
        continue
      }
      const value = values[valueIndex]
      if (!Number.isFinite(value)) {
        continue
      }
      accumulator += value * weight
      weightSum += weight
    }
    const normalizedWeight = weightSum > 0 ? weightSum : defaultWeight
    result[index] = normalizedWeight > 0 ? accumulator / normalizedWeight : 0
  }
  return result
}

function smoothHistogramData(data: HistogramData): HistogramData {
  return {
    red: smoothHistogramChannel(data.red, histogramSmoothingKernel),
    green: smoothHistogramChannel(data.green, histogramSmoothingKernel),
    blue: smoothHistogramChannel(data.blue, histogramSmoothingKernel),
    luminance: smoothHistogramChannel(data.luminance, histogramSmoothingKernel),
  }
}

function isMonochromeHistogram(data: HistogramData): boolean {
  const length = Math.min(data.red.length, data.green.length, data.blue.length)
  const tolerance = 1e-6
  for (let index = 0; index < length; index += 1) {
    const red = data.red[index] ?? 0
    const green = data.green[index] ?? 0
    const blue = data.blue[index] ?? 0
    if (Math.abs(red - green) > tolerance || Math.abs(red - blue) > tolerance || Math.abs(green - blue) > tolerance) {
      return false
    }
  }
  return true
}

function destroyHistogramChart(): void {
  histogramChart.value?.destroy()
  histogramChart.value = null
}

function renderHistogram(): void {
  if (globalThis.document === undefined || !histogramCanvasRef.value || !props.histogram) {
    return
  }
  const context = histogramCanvasRef.value.getContext('2d')
  if (!context) {
    return
  }
  destroyHistogramChart()
  const chartHistogram = smoothHistogramData(props.histogram)
  const labels = chartHistogram.red.map((_, index) => index)
  const monochrome = isMonochromeHistogram(props.histogram)
  const toneOverlay = {
    id: 'toneOverlay',
    beforeDraw(chartInstance: Chart<'line'>) {
      const { ctx, chartArea, scales } = chartInstance
      const xScale = scales.x
      if (!chartArea || !xScale) {
        return
      }
      const zones = [
        { start: 0, end: 85, color: 'rgba(255, 255, 255, 0.02)' },
        { start: 85, end: 170, color: 'rgba(255, 255, 255, 0.03)' },
        { start: 170, end: 255, color: 'rgba(255, 255, 255, 0.02)' },
      ]
      ctx.save()
      for (const zone of zones) {
        const startX = xScale.getPixelForValue(zone.start)
        const endX = xScale.getPixelForValue(zone.end)
        ctx.fillStyle = zone.color
        ctx.fillRect(startX, chartArea.top, endX - startX, chartArea.height)
      }
      ctx.restore()
    },
  }
  const baseDataset = {
    pointRadius: 0,
    tension: 0.45,
    cubicInterpolationMode: 'monotone' as const,
    fill: false,
    borderWidth: 2,
    backgroundColor: 'transparent',
  }
  const datasets = monochrome
    ? [
        {
          label: 'Luminance',
          data: chartHistogram.luminance,
          borderColor: '#ffffff',
          ...baseDataset,
        },
      ]
    : [
        {
          label: 'Red',
          data: chartHistogram.red,
          borderColor: histogramColors.value.red,
          ...baseDataset,
        },
        {
          label: 'Green',
          data: chartHistogram.green,
          borderColor: histogramColors.value.green,
          ...baseDataset,
        },
        {
          label: 'Blue',
          data: chartHistogram.blue,
          borderColor: histogramColors.value.blue,
          ...baseDataset,
        },
      ]
  histogramChart.value = new Chart(context, {
    type: 'line',
    data: {
      labels,
      datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      events: [],
      layout: {
        padding: {
          top: 8,
          right: 10,
          bottom: 8,
          left: 10,
        },
      },
      elements: {
        line: {
          borderJoinStyle: 'round',
        },
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          enabled: false,
        },
      },
      scales: {
        x: {
          display: false,
          grid: {
            display: true,
            color: 'rgba(255, 255, 255, 0.06)',
          },
          border: {
            display: false,
          },
        },
        y: {
          display: false,
          grid: {
            display: true,
            color: 'rgba(255, 255, 255, 0.06)',
          },
          border: {
            display: false,
          },
        },
      },
    },
    plugins: [toneOverlay],
  })
}
</script>

<template>
  <div class="rounded-lg border border-default/20 bg-elevated/80">
    <div class="flex items-center justify-between border-b border-default/10 px-3 py-2 text-xs uppercase tracking-wide text-muted">
      <div class="flex items-center gap-2">
        <Icon name="carbon:chart-line" class="h-4 w-4" />
        <span>{{ t('gallery.histogram.title') }}</span>
      </div>
    </div>
    <div class="space-y-3 p-3">
      <div class="relative h-36 w-full overflow-hidden rounded-md bg-default/60 ring-1 ring-default/10">
        <canvas ref="histogramCanvasRef" class="absolute inset-0 h-full w-full" />
        <div
          v-if="!histogram"
          class="absolute inset-0 flex items-center justify-center gap-2 text-xs text-muted"
        >
          <Icon name="line-md:loading-loop" class="h-4 w-4" />
          <span>{{ t('gallery.histogram.pending') }}</span>
        </div>
      </div>
      <div v-if="histogramSummary" class="grid grid-cols-3 gap-2 text-[11px]">
        <div class="space-y-1">
          <div class="flex items-center justify-between text-muted">
            <span>{{ t('gallery.histogram.shadows') }}</span>
            <span class="font-semibold text-highlighted">{{ histogramSummary.shadows }}%</span>
          </div>
          <div class="h-px w-full overflow-hidden rounded-full bg-default/40">
            <div class="h-full rounded-full bg-primary-500" :style="{ width: `${histogramSummary.shadows}%` }" />
          </div>
        </div>
        <div class="space-y-1">
          <div class="flex items-center justify-between text-muted">
            <span>{{ t('gallery.histogram.midtones') }}</span>
            <span class="font-semibold text-highlighted">{{ histogramSummary.midtones }}%</span>
          </div>
          <div class="h-px w-full overflow-hidden rounded-full bg-default/40">
            <div class="h-full rounded-full bg-primary-500" :style="{ width: `${histogramSummary.midtones}%` }" />
          </div>
        </div>
        <div class="space-y-1">
          <div class="flex items-center justify-between text-muted">
            <span>{{ t('gallery.histogram.highlights') }}</span>
            <span class="font-semibold text-highlighted">{{ histogramSummary.highlights }}%</span>
          </div>
          <div class="h-px w-full overflow-hidden rounded-full bg-default/40">
            <div class="h-full rounded-full bg-primary-500" :style="{ width: `${histogramSummary.highlights}%` }" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
