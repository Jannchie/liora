<script setup lang="ts">
import type { CSSProperties } from 'vue'
import type { RecipeAdjustmentItem } from '~/types/gallery'
import { computed } from 'vue'

// One recipe slider as a read-only row: label and value over a hairline
// track. A zero-centred slider fills from its centre tick; a hue or a colour
// temperature gets its own scale as the track, with a marker at the value,
// since a filled bar says nothing about which hue was picked.
const props = defineProps<{
  item: RecipeAdjustmentItem
}>()

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

const zeroCentered = computed<boolean>(() => props.item.zeroCentered ?? (props.item.min < 0 && props.item.max > 0))

const position = computed<number>(() => {
  const span = props.item.max - props.item.min
  if (!Number.isFinite(span) || span <= 0) {
    return 0
  }
  return ((clamp(props.item.value, props.item.min, props.item.max) - props.item.min) / span) * 100
})

const fillStyle = computed<CSSProperties>(() => {
  if (zeroCentered.value) {
    const span = props.item.max - props.item.min
    const zeroPoint = span > 0 ? ((0 - props.item.min) / span) * 100 : 0
    return {
      left: `${Math.min(zeroPoint, position.value).toFixed(4)}%`,
      width: `${Math.abs(position.value - zeroPoint).toFixed(4)}%`,
    }
  }
  return { left: '0%', width: `${position.value.toFixed(4)}%` }
})

const TRACKS: Record<NonNullable<RecipeAdjustmentItem['track']>, string> = {
  hue: 'linear-gradient(to right, hsl(0 70% 55%), hsl(60 70% 55%), hsl(120 70% 50%), hsl(180 70% 50%), hsl(240 70% 60%), hsl(300 70% 55%), hsl(360 70% 55%))',
  temperature: 'linear-gradient(to right, #5b8def, #c9d8f5 45%, #f3e3c3 55%, #f0a24a)',
}

const trackStyle = computed<CSSProperties | null>(() =>
  props.item.track ? { backgroundImage: TRACKS[props.item.track] } : null,
)

const markerColor = computed<string | undefined>(() =>
  props.item.track === 'hue' ? `hsl(${props.item.value} 70% 55%)` : undefined,
)

const formattedValue = computed<string>(() => {
  const digits = props.item.digits ?? 0
  const rounded = Number(props.item.value.toFixed(digits))
  const sign = zeroCentered.value && rounded > 0 ? '+' : ''
  return `${sign}${rounded.toFixed(digits)}${props.item.unit ?? ''}`
})
</script>

<template>
  <div class="grid gap-1">
    <div class="flex items-center justify-between gap-3 text-xs">
      <span class="min-w-0 truncate text-default">{{ item.label }}</span>
      <span class="num-tabular inline-flex shrink-0 items-center gap-1.5 text-highlighted">
        <span
          v-if="markerColor"
          class="size-2 rounded-full"
          :style="{ backgroundColor: markerColor }"
          aria-hidden="true"
        />
        {{ formattedValue }}
      </span>
    </div>
    <div v-if="trackStyle" class="relative my-px h-1 rounded-full" :style="trackStyle">
      <div
        class="pointer-events-none absolute -top-0.5 -bottom-0.5 w-0.5 -translate-x-1/2 rounded-full bg-primary shadow-[0_0_0_1px_var(--color-default)]"
        :style="{ left: `${position.toFixed(4)}%` }"
      />
    </div>
    <div v-else class="relative h-0.5 bg-border-strong">
      <div
        v-if="zeroCentered"
        class="pointer-events-none absolute -top-0.5 -bottom-0.5 left-1/2 w-px -translate-x-1/2 bg-fg-dimmed"
      />
      <div
        class="absolute bottom-0 top-0"
        :class="zeroCentered && item.value < 0 ? 'bg-primary/55' : 'bg-primary'"
        :style="fillStyle"
      />
    </div>
  </div>
</template>
