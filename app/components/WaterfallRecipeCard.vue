<script setup lang="ts">
import type { CSSProperties } from 'vue'
import type { RecipeAdjustmentGroup, RecipeAdjustmentItem, RecipeCurvePoint, RecipeToneCurve } from '~/types/gallery'
import { computed } from 'vue'

// Renders one editor's recipe: badge row, tone curve, then the slider groups.
// Shared by the Lightroom (`crs:*`) and LLR (`llr:*`) cards — the two differ
// only in which badges they supply, so the drawing lives here once.
const props = defineProps<{
  title: string
  badges?: string[]
  toneCurve?: RecipeToneCurve | null
  groups: RecipeAdjustmentGroup[]
}>()

const { t } = useI18n()

interface ToneCurveChannel {
  key: 'composite' | 'red' | 'green' | 'blue'
  label: string
  color: string
  points: RecipeCurvePoint[]
}

const toneCurveChannels = computed<ToneCurveChannel[]>(() => {
  const toneCurve = props.toneCurve
  if (!toneCurve) {
    return []
  }
  const candidates: ToneCurveChannel[] = [
    { key: 'composite', label: 'RGB', color: '#9ca3af', points: toneCurve.composite ?? [] },
    { key: 'red', label: 'R', color: '#ef4444', points: toneCurve.red ?? [] },
    { key: 'green', label: 'G', color: '#22c55e', points: toneCurve.green ?? [] },
    { key: 'blue', label: 'B', color: '#3b82f6', points: toneCurve.blue ?? [] },
  ]
  return candidates.filter(channel => channel.points.length >= 2)
})

const toneCurveName = computed<string | null>(() => {
  const named = props.toneCurve?.name
  if (named && named.trim().length > 0) {
    return named
  }
  return toneCurveChannels.value.length > 0 ? 'Custom' : null
})

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function isZeroCentered(item: RecipeAdjustmentItem): boolean {
  if (item.zeroCentered !== undefined) {
    return item.zeroCentered
  }
  return item.min < 0 && item.max > 0
}

function buildSliderFillStyle(item: RecipeAdjustmentItem): CSSProperties {
  const span = item.max - item.min
  if (!Number.isFinite(span) || span <= 0) {
    return { left: '0%', width: '0%' }
  }
  const clamped = clamp(item.value, item.min, item.max)
  if (isZeroCentered(item)) {
    const zeroPoint = ((0 - item.min) / span) * 100
    const valuePoint = ((clamped - item.min) / span) * 100
    const left = Math.min(zeroPoint, valuePoint)
    const width = Math.abs(valuePoint - zeroPoint)
    return {
      left: `${left.toFixed(4)}%`,
      width: `${width.toFixed(4)}%`,
    }
  }
  const valuePoint = ((clamped - item.min) / span) * 100
  return {
    left: '0%',
    width: `${valuePoint.toFixed(4)}%`,
  }
}

function formatAdjustmentValue(item: RecipeAdjustmentItem): string {
  const digits = item.digits ?? 0
  const rounded = Number(item.value.toFixed(digits))
  const sign = isZeroCentered(item) && rounded > 0 ? '+' : ''
  const suffix = item.unit ?? ''
  return `${sign}${rounded.toFixed(digits)}${suffix}`
}

function sliderFillClass(item: RecipeAdjustmentItem): string {
  if (isZeroCentered(item) && item.value < 0) {
    return 'bg-primary/55'
  }
  return 'bg-primary'
}

function buildToneCurvePath(points: RecipeCurvePoint[]): string {
  if (points.length < 2) {
    return ''
  }
  return points
    .map((point, index) => {
      const x = clamp(point.x, 0, 255)
      const y = 255 - clamp(point.y, 0, 255)
      const command = index === 0 ? 'M' : 'L'
      return `${command}${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')
}
</script>

<template>
  <div class="grid gap-2 rounded-md bg-default/60 px-2 py-2 ring-1 ring-default/15">
    <p class="flex items-center gap-2 text-xs font-medium text-muted">
      <Icon name="tabler:adjustments-horizontal" class="h-4 w-4" />
      <span>{{ title }}</span>
    </p>
    <div v-if="(badges?.length ?? 0) > 0 || toneCurveName" class="flex flex-wrap gap-1.5">
      <span
        v-for="badge in badges ?? []"
        :key="badge"
        class="inline-flex items-center rounded-full bg-default/30 px-2 py-0.5 text-[10px] text-muted ring-1 ring-default/15"
      >
        {{ badge }}
      </span>
      <span
        v-if="toneCurveName"
        class="inline-flex items-center rounded-full bg-default/30 px-2 py-0.5 text-[10px] text-muted ring-1 ring-default/15"
      >
        {{ `Curve ${toneCurveName}` }}
      </span>
    </div>
    <div
      v-if="toneCurveChannels.length > 0"
      class="space-y-1.5 rounded-md border border-default/10 bg-default/40 px-2 py-2"
    >
      <div class="flex items-center justify-between label-caption-sm">
        <span>{{ t('gallery.metadata.toneCurve') }}</span>
        <span v-if="toneCurveName" class="text-highlighted">{{ toneCurveName }}</span>
      </div>
      <svg
        viewBox="0 0 255 255"
        class="h-28 w-full rounded border border-default/10 bg-default/20"
        role="img"
        :aria-label="t('gallery.metadata.toneCurve')"
      >
        <path d="M0 255 L255 0" stroke="#6b7280" stroke-width="1" stroke-dasharray="4 4" fill="none" />
        <path
          v-for="channel in toneCurveChannels"
          :key="channel.key"
          :d="buildToneCurvePath(channel.points)"
          :stroke="channel.color"
          stroke-width="2"
          fill="none"
        />
      </svg>
      <div class="flex flex-wrap gap-1">
        <span
          v-for="channel in toneCurveChannels"
          :key="`${channel.key}-legend`"
          class="inline-flex items-center gap-1 rounded-full bg-default/25 px-2 py-0.5 text-[10px] text-muted ring-1 ring-default/15"
        >
          <span class="h-1.5 w-1.5 rounded-full" :style="{ backgroundColor: channel.color }" />
          <span>{{ channel.label }}</span>
        </span>
      </div>
    </div>
    <div class="space-y-2">
      <div
        v-for="group in groups"
        :key="group.key"
        class="space-y-1.5 rounded-md border border-default/10 bg-default/40 px-2 py-2"
      >
        <p class="label-caption-sm">
          {{ group.label }}
        </p>
        <div class="space-y-1.5">
          <div
            v-for="item in group.items"
            :key="item.key"
            class="grid gap-1"
          >
            <div class="flex items-center justify-between text-[11px] text-muted">
              <span class="font-medium text-highlighted">{{ item.label }}</span>
              <span>{{ formatAdjustmentValue(item) }}</span>
            </div>
            <div class="relative h-px rounded bg-accented ring-1 ring-default/10">
              <div
                v-if="isZeroCentered(item)"
                class="pointer-events-none absolute bottom-0 left-1/2 top-0 w-px -translate-x-1/2 bg-default/60"
              />
              <div
                class="absolute bottom-0 top-0 rounded"
                :class="sliderFillClass(item)"
                :style="buildSliderFillStyle(item)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
