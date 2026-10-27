<script setup lang="ts">
import type { LlrMaskView, RecipeAdjustmentGroup, RecipeCurvePoint, RecipeFact, RecipeToneCurve } from '~/types/gallery'
import { computed } from 'vue'
import { sampleToneCurve } from '~/utils/tone-curve'

// Renders one editor's recipe: badge row, settings, tone curve, masks, then
// the slider groups. Shared by the Lightroom (`crs:*`) and LLR (`llr:*`)
// sections — LLR supplies more of it (facts, masks, bypassed panels), so the
// drawing lives here once.
const props = withDefaults(
  defineProps<{
    title: string
    badges?: string[]
    /** Non-slider settings, as key / value rows. */
    facts?: RecipeFact[]
    toneCurve?: RecipeToneCurve | null
    toneCurveBypassed?: boolean
    groups: RecipeAdjustmentGroup[]
    /** Local adjustments, each with its own selection. */
    masks?: LlrMaskView[]
    masksBypassed?: boolean
  }>(),
  {
    badges: () => [],
    facts: () => [],
    masks: () => [],
  },
)

const { t } = useI18n()

interface ToneCurveChannel {
  key: 'parametric' | 'composite' | 'red' | 'green' | 'blue'
  label: string
  color: string
  path: string
  /** Control points to mark; a sampled curve (parametric) has none. */
  handles: RecipeCurvePoint[]
}

const toneCurveChannels = computed<ToneCurveChannel[]>(() => {
  const toneCurve = props.toneCurve
  if (!toneCurve) {
    return []
  }
  const channels: ToneCurveChannel[] = []
  // The parametric curve runs first in the editor's stack, so it sits under
  // the point curves; dashed to tell it from the RGB master.
  if (toneCurve.parametric && toneCurve.parametric.length >= 2) {
    channels.push({
      key: 'parametric',
      label: t('gallery.llr.group.parametric'),
      color: '#a78bfa',
      path: buildPath(toneCurve.parametric),
      handles: [],
    })
  }
  const pointChannels = [
    { key: 'composite', label: 'RGB', color: '#d1d5db', points: toneCurve.composite },
    { key: 'red', label: 'R', color: '#ef4444', points: toneCurve.red },
    { key: 'green', label: 'G', color: '#22c55e', points: toneCurve.green },
    { key: 'blue', label: 'B', color: '#3b82f6', points: toneCurve.blue },
  ] as const
  for (const channel of pointChannels) {
    if (channel.points && channel.points.length >= 2) {
      channels.push({
        key: channel.key,
        label: channel.label,
        color: channel.color,
        path: buildPath(sampleToneCurve(channel.points, 255)),
        handles: channel.points,
      })
    }
  }
  return channels
})

// Only a named curve (Lightroom's "Medium Contrast", …) says anything beyond
// the plot itself.
const toneCurveName = computed<string | null>(() => {
  const named = props.toneCurve?.name?.trim()
  return named && named.length > 0 ? named : null
})

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function buildPath(samples: RecipeCurvePoint[]): string {
  return samples
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
  <!--
    One section of the viewer's info column. The head carries the caption and
    the badges; settings follow as key / value rows, then the tone curve, the
    masks and the slider groups as sub-blocks split by full-width hairlines
    rather than nested cards. A panel switched off in the editor keeps its
    values but is dimmed and tagged, the way the editor shows it.
  -->
  <section class="border-b border-border">
    <div class="space-y-3 px-5 pb-3 pt-4">
      <p class="label-caption flex items-center gap-1.5 text-dimmed">
        <Icon name="jannchie:sliders" class="h-3.5 w-3.5" />
        <span>{{ title }}</span>
      </p>
      <div v-if="badges.length > 0" class="flex flex-wrap gap-1">
        <span
          v-for="badge in badges"
          :key="badge"
          class="inline-flex items-center rounded-full bg-muted px-2 py-px text-xs leading-5 text-highlighted"
        >
          {{ badge }}
        </span>
      </div>
    </div>
    <dl v-if="facts.length > 0" class="pb-2 [--meta-row-py:0.25rem]">
      <div v-for="fact in facts" :key="fact.key" class="meta-row" :class="fact.bypassed ? 'opacity-50' : undefined">
        <dt class="meta-key">
          <span class="truncate">{{ fact.label }}</span>
        </dt>
        <dd class="meta-value flex items-start justify-between gap-2 text-xs">
          <span class="min-w-0" :class="fact.bypassed ? 'line-through' : undefined">{{ fact.value }}</span>
          <span v-if="fact.bypassed" class="recipe-off">{{ t('gallery.llr.bypassed') }}</span>
        </dd>
      </div>
    </dl>
    <div
      v-if="toneCurveChannels.length > 0"
      class="space-y-2 border-t border-border px-5 py-3"
      :class="toneCurveBypassed ? 'opacity-50' : undefined"
    >
      <div class="label-caption-sm flex items-center justify-between text-dimmed">
        <span>{{ t('gallery.metadata.toneCurve') }}</span>
        <span v-if="toneCurveBypassed" class="recipe-off">{{ t('gallery.llr.bypassed') }}</span>
        <span v-else-if="toneCurveName" class="text-highlighted">{{ toneCurveName }}</span>
      </div>
      <svg
        viewBox="0 0 255 255"
        class="aspect-square w-full max-w-48 overflow-visible rounded-md border border-border bg-muted"
        role="img"
        :aria-label="t('gallery.metadata.toneCurve')"
      >
        <path
          d="M63.75 0 V255 M127.5 0 V255 M191.25 0 V255 M0 63.75 H255 M0 127.5 H255 M0 191.25 H255"
          stroke="currentColor"
          class="text-border"
          stroke-width="1"
          vector-effect="non-scaling-stroke"
          fill="none"
        />
        <path
          d="M0 255 L255 0"
          stroke="#6b7280"
          stroke-width="1"
          stroke-dasharray="4 4"
          vector-effect="non-scaling-stroke"
          fill="none"
        />
        <path
          v-for="channel in toneCurveChannels"
          :key="channel.key"
          :d="channel.path"
          :stroke="channel.color"
          :stroke-dasharray="channel.key === 'parametric' ? '6 3' : undefined"
          stroke-width="1.5"
          stroke-linejoin="round"
          vector-effect="non-scaling-stroke"
          fill="none"
        />
        <template v-for="channel in toneCurveChannels" :key="`${channel.key}-handles`">
          <circle
            v-for="(point, pointIndex) in channel.handles"
            :key="pointIndex"
            :cx="point.x"
            :cy="255 - point.y"
            r="4"
            :fill="channel.color"
            stroke="var(--color-muted)"
            stroke-width="1.5"
            vector-effect="non-scaling-stroke"
          />
        </template>
      </svg>
      <div class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-dimmed">
        <span
          v-for="channel in toneCurveChannels"
          :key="`${channel.key}-legend`"
          class="inline-flex items-center gap-1.5"
        >
          <span class="h-1.5 w-1.5 rounded-full" :style="{ backgroundColor: channel.color }" />
          <span>{{ channel.label }}</span>
        </span>
      </div>
    </div>
    <div
      v-for="(mask, maskIndex) in masks"
      :key="mask.key"
      class="space-y-2 border-t border-border px-5 py-3"
      :class="mask.disabled || masksBypassed ? 'opacity-50' : undefined"
    >
      <div class="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <p class="label-caption-sm flex min-w-0 items-center gap-1.5 text-dimmed">
          <Icon name="jannchie:fill-mask" class="h-3.5 w-3.5" />
          <span class="truncate text-highlighted">{{
            mask.name || t('gallery.metadata.llrMaskFallback', { index: maskIndex + 1 })
          }}</span>
        </p>
        <span v-if="mask.disabled || mask.inverted || masksBypassed" class="flex gap-1">
          <span v-if="mask.inverted" class="recipe-tag">
            {{ t('gallery.metadata.llrMaskInverted') }}
          </span>
          <span v-if="masksBypassed" class="recipe-off">
            {{ t('gallery.llr.bypassed') }}
          </span>
          <span v-else-if="mask.disabled" class="recipe-tag">
            {{ t('gallery.metadata.llrMaskDisabled') }}
          </span>
        </span>
      </div>
      <p v-if="mask.components.length > 0" class="flex flex-wrap gap-1">
        <span
          v-for="(component, componentIndex) in mask.components"
          :key="`${mask.key}-c${componentIndex}`"
          class="recipe-tag"
        >
          {{ component }}
        </span>
      </p>
      <div v-if="mask.items.length > 0" class="space-y-2">
        <RecipeSliderRow v-for="item in mask.items" :key="`${mask.key}-${item.key}`" :item="item" />
      </div>
    </div>
    <div
      v-for="group in groups"
      :key="group.key"
      class="space-y-2 border-t border-border px-5 py-3"
      :class="group.bypassed ? 'opacity-50' : undefined"
    >
      <div class="flex items-center justify-between gap-2">
        <p class="label-caption-sm text-dimmed">
          {{ group.label }}
        </p>
        <span v-if="group.bypassed" class="recipe-off">{{ t('gallery.llr.bypassed') }}</span>
      </div>
      <div class="space-y-2">
        <RecipeSliderRow v-for="item in group.items" :key="item.key" :item="item" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.recipe-tag,
.recipe-off {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  border-radius: 9999px;
  padding: 0 0.375rem;
  font-size: 11px;
  line-height: 1rem;
}

.recipe-tag {
  border: 1px solid var(--color-border-strong);
  color: var(--color-fg-muted);
}

.recipe-off {
  background: var(--color-warning-soft);
  color: var(--color-warning);
}
</style>
