<script setup lang="ts">
import type { CSSProperties } from 'vue'
import type { LightroomAdjustmentItem, LightroomRecipeView, MetadataEntry } from '~/types/gallery'
import { computed, defineAsyncComponent } from 'vue'

const props = defineProps<{
  hasMetadata: boolean
  metadataEntries: MetadataEntry[]
  focusEntry?: MetadataEntry | null
  cropEntry?: MetadataEntry | null
  lightroomRecipe?: LightroomRecipeView | null
  exposureEntries: MetadataEntry[]
  focusIndicatorActive?: boolean
}>()

const emit = defineEmits<{
  (event: 'focusHover', value: boolean): void
  (event: 'focusToggle'): void
}>()

const BrandIcon = defineAsyncComponent(() => import('~/components/BrandIcon.vue'))

function isMetadataEntry(value: MetadataEntry | null | undefined): value is MetadataEntry {
  return value != null
}

const { t } = useI18n()

const metadataEntries = computed<MetadataEntry[]>(() => props.metadataEntries)
const focusEntry = computed<MetadataEntry | null>(() => props.focusEntry ?? null)
const cropEntry = computed<MetadataEntry | null>(() => props.cropEntry ?? null)
const lightroomRecipe = computed<LightroomRecipeView | null>(() => props.lightroomRecipe ?? null)
const exposureEntries = computed<MetadataEntry[]>(() => props.exposureEntries)
const hasMetadata = computed<boolean>(() => props.hasMetadata)
const focusIndicatorActive = computed<boolean>(() => props.focusIndicatorActive ?? false)

function handleFocusHover(value: boolean): void {
  emit('focusHover', value)
}

function handleFocusToggle(): void {
  emit('focusToggle')
}

const primaryExposureLabels = computed(() => ({
  shutterSpeed: t('gallery.metadata.shutterSpeed'),
  aperture: t('gallery.metadata.aperture'),
  iso: t('gallery.metadata.iso'),
  focalLength: t('gallery.metadata.focalLength'),
  exposureBias: t('gallery.metadata.exposureBias'),
}))

const mainExposureEntries = computed<MetadataEntry[]>(() => {
  const labels = primaryExposureLabels.value
  const order = [
    labels.shutterSpeed,
    labels.aperture,
    labels.iso,
  ]
  return order
    .map(label => exposureEntries.value.find(entry => entry.label === label))
    .filter(entry => isMetadataEntry(entry))
})

const halfWidthExposureEntries = computed<MetadataEntry[]>(() => {
  const labels = primaryExposureLabels.value
  const order = [
    labels.focalLength,
    labels.exposureBias,
  ]
  return order
    .map(label => exposureEntries.value.find(entry => entry.label === label))
    .filter(entry => isMetadataEntry(entry))
})

const secondaryExposureEntries = computed<MetadataEntry[]>(() => {
  const primaryLabels = new Set(Object.values(primaryExposureLabels.value))
  return exposureEntries.value.filter(entry => !primaryLabels.has(entry.label))
})

const totalEntryCount = computed<number>(() => {
  const focusCount = focusEntry.value ? 1 : 0
  const cropCount = cropEntry.value ? 1 : 0
  const lightroomCount = lightroomRecipe.value ? 1 : 0
  return metadataEntries.value.length + exposureEntries.value.length + focusCount + cropCount + lightroomCount
})

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function isZeroCentered(item: LightroomAdjustmentItem): boolean {
  if (item.zeroCentered !== undefined) {
    return item.zeroCentered
  }
  return item.min < 0 && item.max > 0
}

function buildSliderFillStyle(item: LightroomAdjustmentItem): CSSProperties {
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

function formatAdjustmentValue(item: LightroomAdjustmentItem): string {
  const digits = item.digits ?? 0
  const rounded = Number(item.value.toFixed(digits))
  const sign = isZeroCentered(item) && rounded > 0 ? '+' : ''
  const suffix = item.unit ?? ''
  return `${sign}${rounded.toFixed(digits)}${suffix}`
}

function sliderFillClass(item: LightroomAdjustmentItem): string {
  if (isZeroCentered(item) && item.value < 0) {
    return 'bg-primary/55'
  }
  return 'bg-primary'
}
</script>

<template>
  <div class="rounded-lg border border-default/20 bg-elevated/80 text-sm text-default">
    <div class="flex items-center justify-between border-b border-default/10 px-3 py-2 text-xs uppercase tracking-wide text-muted">
      <div class="flex items-center gap-2">
        <Icon name="tabler:info-circle" class="h-4 w-4" />
        <span>{{ t('gallery.metadata.section') }}</span>
      </div>
      <span class="rounded-full bg-default/60 px-2 py-0.5 text-xs font-semibold text-highlighted ring-1 ring-default/15">
        {{ totalEntryCount }}
      </span>
    </div>
    <div v-if="hasMetadata" class="space-y-3 p-3">
      <div v-if="mainExposureEntries.length > 0 || halfWidthExposureEntries.length > 0" class="space-y-3">
        <div class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
          <Icon name="tabler:adjustments" class="h-4 w-4" />
          <span>{{ t('gallery.metadata.exposure') }}</span>
        </div>
        <div v-if="mainExposureEntries.length > 0" class="grid grid-cols-3 gap-2">
          <div
            v-for="item in mainExposureEntries"
            :key="item.label"
            class="flex items-center gap-2 rounded-md bg-default/70 px-2 py-1.5 ring-1 ring-default/15"
            :aria-label="`${item.label}: ${item.value}`"
          >
            <Icon :name="item.icon" class="h-4 w-4 text-muted" />
            <div class="flex flex-col leading-tight">
              <span class="text-[10px] uppercase tracking-wide text-muted">{{ item.label }}</span>
              <span class="text-sm font-semibold text-highlighted">{{ item.value }}</span>
            </div>
          </div>
        </div>
        <div v-if="halfWidthExposureEntries.length > 0" class="grid grid-cols-2 gap-2">
          <div
            v-for="item in halfWidthExposureEntries"
            :key="item.label"
            class="flex items-center gap-2 rounded-md bg-default/70 px-2 py-2 ring-1 ring-default/15"
            :aria-label="`${item.label}: ${item.value}`"
          >
            <Icon :name="item.icon" class="h-4 w-4 text-muted" />
            <div class="flex flex-col leading-tight">
              <span class="text-[10px] uppercase tracking-wide text-muted">{{ item.label }}</span>
              <span class="text-base font-semibold text-highlighted">{{ item.value }}</span>
            </div>
          </div>
        </div>
      </div>
      <div v-if="focusEntry || cropEntry || lightroomRecipe || metadataEntries.length > 0" class="space-y-2">
        <button
          v-if="focusEntry"
          type="button"
          class="grid w-full gap-1 rounded-md bg-default/60 px-2 py-2 text-left ring-1 ring-default/15 transition-colors hover:bg-green-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500/60"
          :class="focusIndicatorActive ? 'bg-green-500/10 ring-green-500/40' : undefined"
          @mouseenter="handleFocusHover(true)"
          @mouseleave="handleFocusHover(false)"
          @focus="handleFocusHover(true)"
          @blur="handleFocusHover(false)"
          @click="handleFocusToggle"
        >
          <p class="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted">
            <Icon :name="focusEntry.icon" class="h-4 w-4" />
            <span>{{ focusEntry.label }}</span>
          </p>
          <p class="text-sm leading-snug whitespace-pre-line text-highlighted">
            {{ focusEntry.value }}
          </p>
        </button>
        <div
          v-if="cropEntry"
          class="grid gap-1 rounded-md bg-default/60 px-2 py-2 ring-1 ring-default/15"
        >
          <p class="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted">
            <Icon :name="cropEntry.icon" class="h-4 w-4" />
            <span>{{ cropEntry.label }}</span>
          </p>
          <p class="text-sm leading-snug whitespace-pre-line text-highlighted">
            {{ cropEntry.value }}
          </p>
        </div>
        <div
          v-if="lightroomRecipe"
          class="grid gap-2 rounded-md bg-default/60 px-2 py-2 ring-1 ring-default/15"
        >
          <p class="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted">
            <Icon name="tabler:adjustments-horizontal" class="h-4 w-4" />
            <span>{{ t('gallery.metadata.lightroom') }}</span>
          </p>
          <div
            v-if="lightroomRecipe.processVersion || lightroomRecipe.profile || lightroomRecipe.whiteBalance || lightroomRecipe.toneCurve"
            class="flex flex-wrap gap-1.5"
          >
            <span
              v-if="lightroomRecipe.processVersion"
              class="inline-flex items-center rounded-full bg-default/30 px-2 py-0.5 text-[10px] text-muted ring-1 ring-default/15"
            >
              {{ `PV ${lightroomRecipe.processVersion}` }}
            </span>
            <span
              v-if="lightroomRecipe.profile"
              class="inline-flex items-center rounded-full bg-default/30 px-2 py-0.5 text-[10px] text-muted ring-1 ring-default/15"
            >
              {{ lightroomRecipe.profile }}
            </span>
            <span
              v-if="lightroomRecipe.whiteBalance"
              class="inline-flex items-center rounded-full bg-default/30 px-2 py-0.5 text-[10px] text-muted ring-1 ring-default/15"
            >
              {{ `WB ${lightroomRecipe.whiteBalance}` }}
            </span>
            <span
              v-if="lightroomRecipe.toneCurve"
              class="inline-flex items-center rounded-full bg-default/30 px-2 py-0.5 text-[10px] text-muted ring-1 ring-default/15"
            >
              {{ `Curve ${lightroomRecipe.toneCurve}` }}
            </span>
          </div>
          <div class="space-y-2">
            <div
              v-for="group in lightroomRecipe.groups"
              :key="group.key"
              class="space-y-1.5 rounded-md border border-default/10 bg-default/40 px-2 py-2"
            >
              <p class="text-[10px] font-semibold uppercase tracking-wide text-muted">
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
                  <div class="relative h-px rounded bg-default/35 ring-1 ring-default/15">
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
        <div
          v-for="item in metadataEntries"
          :key="item.key ?? item.label"
          class="grid gap-1 rounded-md bg-default/60 px-2 py-2 ring-1 ring-default/15"
        >
          <p class="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted">
            <Icon :name="item.icon" class="h-4 w-4" />
            <span>{{ item.label }}</span>
          </p>
          <p
            v-if="item.valueIcon"
            class="flex items-center gap-2 text-sm leading-snug text-highlighted"
          >
            <BrandIcon :name="item.valueIcon" class="h-[1em] text-highlighted" />
            <span v-if="item.valueIconLabel" class="sr-only">{{ item.valueIconLabel }}</span>
            <span>{{ item.value }}</span>
          </p>
          <p v-else class="text-sm leading-snug text-highlighted">
            {{ item.value }}
          </p>
        </div>
      </div>
      <div v-if="secondaryExposureEntries.length > 0" class="space-y-2 border-t border-default/10 pt-3">
        <div class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
          <Icon name="tabler:adjustments" class="h-4 w-4" />
          <span>{{ t('gallery.metadata.exposure') }}</span>
        </div>
        <div class="flex flex-wrap gap-2">
          <div
            v-for="item in secondaryExposureEntries"
            :key="item.label"
            class="inline-flex items-center gap-1.5 rounded-full bg-default/30 px-2.5 py-1 text-xs text-muted ring-1 ring-default/10"
            :aria-label="`${item.label}: ${item.value}`"
          >
            <Icon :name="item.icon" class="h-3.5 w-3.5 text-muted" />
            <span class="font-medium">{{ item.label }}</span>
            <span class="text-highlighted/80">· {{ item.value }}</span>
          </div>
        </div>
      </div>
    </div>
    <div v-else class="px-3 py-4 text-sm text-muted">
      <p class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
        <Icon name="tabler:alert-triangle" class="h-4 w-4" />
        <span>{{ t('gallery.metadata.section') }}</span>
      </p>
      <p class="mt-2 flex items-center gap-2 text-highlighted">
        <Icon name="tabler:info-circle" class="h-4 w-4 text-muted" />
        <span>{{ t('gallery.metadata.empty') }}</span>
      </p>
    </div>
  </div>
</template>
