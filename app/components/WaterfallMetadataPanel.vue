<script setup lang="ts">
import type { LightroomRecipeView, LlrRecipeView, MetadataEntry } from '~/types/gallery'
import { computed, defineAsyncComponent } from 'vue'

const props = defineProps<{
  hasMetadata: boolean
  metadataEntries: MetadataEntry[]
  focusEntry?: MetadataEntry | null
  cropEntry?: MetadataEntry | null
  lightroomRecipe?: LightroomRecipeView | null
  llrRecipe?: LlrRecipeView | null
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
const llrRecipe = computed<LlrRecipeView | null>(() => props.llrRecipe ?? null)
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
  const order = [labels.shutterSpeed, labels.aperture, labels.iso]
  return order
    .map(label => exposureEntries.value.find(entry => entry.label === label))
    .filter(entry => isMetadataEntry(entry))
})

const halfWidthExposureEntries = computed<MetadataEntry[]>(() => {
  const labels = primaryExposureLabels.value
  const order = [labels.focalLength, labels.exposureBias]
  return order
    .map(label => exposureEntries.value.find(entry => entry.label === label))
    .filter(entry => isMetadataEntry(entry))
})

// Both exposure rows share one column count, so the second row's dividers
// fall on the first row's instead of splitting it differently.
const exposureColumns = computed<number>(() =>
  Math.max(mainExposureEntries.value.length, halfWidthExposureEntries.value.length, 1),
)

const secondaryExposureEntries = computed<MetadataEntry[]>(() => {
  const primaryLabels = new Set(Object.values(primaryExposureLabels.value))
  return exposureEntries.value.filter(entry => !primaryLabels.has(entry.label))
})

const cameraLook = computed<string | null>(() => {
  const raw = lightroomRecipe.value?.cameraLook
  if (!raw || raw.trim().length === 0) {
    return null
  }
  return raw.trim()
})

const lightroomProfile = computed<string | null>(() => {
  const raw = lightroomRecipe.value?.profile
  if (!raw || raw.trim().length === 0) {
    return null
  }
  return raw.trim()
})

function normalizeLookKey(value: string | null | undefined): string {
  if (!value) {
    return ''
  }
  return value.toLowerCase().replaceAll(/[^a-z0-9]+/g, '')
}

const isLookOverridden = computed<boolean>(() => {
  if (!cameraLook.value || !lightroomProfile.value) {
    return false
  }
  const cameraKey = normalizeLookKey(cameraLook.value)
  const profileKey = normalizeLookKey(lightroomProfile.value)
  if (!cameraKey || !profileKey) {
    return false
  }
  return cameraKey !== profileKey
})

const showCameraLookCard = computed<boolean>(() => Boolean(cameraLook.value) && !isLookOverridden.value)

const lightroomBadges = computed<string[]>(() => {
  const recipe = lightroomRecipe.value
  if (!recipe) {
    return []
  }
  return [
    recipe.processVersion ? `PV ${recipe.processVersion}` : null,
    lightroomProfile.value ? `${t('gallery.metadata.lightroomProfile')}: ${lightroomProfile.value}` : null,
    isLookOverridden.value && cameraLook.value
      ? t('gallery.metadata.cameraLookOverriddenWithValue', { value: cameraLook.value })
      : null,
    recipe.whiteBalance ? `WB ${recipe.whiteBalance}` : null,
  ].filter((badge): badge is string => badge !== null)
})

// Only the export's schema version and the camera-matching switches are
// badges; the rest of the recipe's settings read as key / value rows.
const llrBadges = computed<string[]>(() => {
  const recipe = llrRecipe.value
  if (!recipe) {
    return []
  }
  return [recipe.version ? `v${recipe.version}` : null, ...recipe.toggles].filter(
    (badge): badge is string => badge !== null,
  )
})

const totalEntryCount = computed<number>(() => {
  const focusCount = focusEntry.value ? 1 : 0
  const cropCount = cropEntry.value ? 1 : 0
  const lightroomCount = lightroomRecipe.value ? 1 : 0
  const llrCount = llrRecipe.value ? 1 : 0
  const cameraLookCount = showCameraLookCard.value ? 1 : 0
  return (
    metadataEntries.value.length +
    exposureEntries.value.length +
    focusCount +
    cropCount +
    lightroomCount +
    llrCount +
    cameraLookCount
  )
})
</script>

<template>
  <!--
    Sections of the viewer's info column, stacked edge to edge and closed by
    one hairline each. Exposure is a strip of cells on one shared column
    grid, with the shooting modes as pills under it; the rest of the EXIF is
    a key / value list — label column on the left, value on the right — so
    a dozen fields read as one table instead of a dozen blocks.
    Numbers (exposure values, dates, sizes) are set in mono.
  -->
  <div class="text-[13px] text-default">
    <template v-if="hasMetadata">
      <section
        v-if="
          mainExposureEntries.length > 0 || halfWidthExposureEntries.length > 0 || secondaryExposureEntries.length > 0
        "
        class="border-b border-border"
      >
        <p class="label-caption flex items-center gap-1.5 px-5 pb-3 pt-4">
          <Icon name="jannchie:sliders" class="h-3.5 w-3.5" />
          <span>{{ t('gallery.metadata.exposure') }}</span>
        </p>
        <template v-for="(row, rowIndex) in [mainExposureEntries, halfWidthExposureEntries]" :key="rowIndex">
          <div
            v-if="row.length > 0"
            class="grid divide-x divide-border border-t border-border"
            :style="{ gridTemplateColumns: `repeat(${exposureColumns}, minmax(0, 1fr))` }"
          >
            <div
              v-for="item in row"
              :key="item.label"
              class="flex min-w-0 flex-col gap-1.5 px-4 py-3"
              :aria-label="`${item.label}: ${item.value}`"
            >
              <span class="label-caption-sm flex items-center gap-1">
                <Icon :name="item.icon" class="h-3 w-3" />
                <span class="truncate">{{ item.label }}</span>
              </span>
              <span class="num-tabular truncate text-[15px] leading-tight text-highlighted">{{ item.value }}</span>
            </div>
          </div>
        </template>
        <div v-if="secondaryExposureEntries.length > 0" class="flex flex-wrap gap-1 border-t border-border px-4 py-3">
          <span
            v-for="item in secondaryExposureEntries"
            :key="item.label"
            class="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-px text-xs leading-5 text-dimmed"
            :aria-label="`${item.label}: ${item.value}`"
          >
            <span>{{ item.label }}</span>
            <span class="text-highlighted">{{ item.value }}</span>
          </span>
        </div>
      </section>
      <section
        v-if="focusEntry || cropEntry || showCameraLookCard || metadataEntries.length > 0"
        class="border-b border-border pb-3"
      >
        <p class="label-caption flex items-center gap-1.5 px-5 pb-2 pt-4">
          <Icon name="jannchie:info" class="h-3.5 w-3.5" />
          <span>{{ t('gallery.metadata.section') }}</span>
          <span class="num-tabular text-subtle">{{ totalEntryCount }}</span>
        </p>
        <div class="flex flex-col">
          <!-- The focus row keeps the viewfinder green: it drives the AF box drawn on the photo. -->
          <button
            v-if="focusEntry"
            type="button"
            class="meta-row w-full text-left outline-none transition-colors hover:bg-focus-point-soft focus-visible:bg-focus-point-soft"
            :class="
              focusIndicatorActive ? 'bg-focus-point-soft shadow-[inset_2px_0_0_var(--color-focus-point)]' : undefined
            "
            @mouseenter="handleFocusHover(true)"
            @mouseleave="handleFocusHover(false)"
            @focus="handleFocusHover(true)"
            @blur="handleFocusHover(false)"
            @click="handleFocusToggle"
          >
            <span class="meta-key" :class="focusIndicatorActive ? 'text-focus-point' : undefined">
              <Icon :name="focusEntry.icon" class="h-3.5 w-3.5" />
              <span>{{ focusEntry.label }}</span>
            </span>
            <span class="meta-value whitespace-pre-line num-tabular text-xs">
              {{ focusEntry.value }}
            </span>
          </button>
          <div v-if="cropEntry" class="meta-row">
            <span class="meta-key">
              <Icon :name="cropEntry.icon" class="h-3.5 w-3.5" />
              <span>{{ cropEntry.label }}</span>
            </span>
            <span class="meta-value num-tabular whitespace-pre-line text-xs">
              {{ cropEntry.value }}
            </span>
          </div>
          <div v-if="showCameraLookCard && cameraLook" class="meta-row">
            <span class="meta-key">
              <Icon name="jannchie:camera" class="h-3.5 w-3.5" />
              <span>{{ t('gallery.metadata.cameraLook') }}</span>
            </span>
            <span class="meta-value">
              {{ cameraLook }}
            </span>
          </div>
          <div v-for="item in metadataEntries" :key="item.key ?? item.label" class="meta-row">
            <span class="meta-key">
              <Icon :name="item.icon" class="h-3.5 w-3.5" />
              <span>{{ item.label }}</span>
            </span>
            <span v-if="item.valueIcon" class="meta-value flex items-center gap-2">
              <BrandIcon :name="item.valueIcon" class="h-[0.95em] shrink-0 text-highlighted" />
              <span v-if="item.valueIconLabel" class="sr-only">{{ item.valueIconLabel }}</span>
              <span class="min-w-0">{{ item.value }}</span>
            </span>
            <!-- Capture time and pixel size are numbers: tabular figures, like the exposure strip. -->
            <span
              v-else
              class="meta-value whitespace-pre-line"
              :class="
                item.icon === 'jannchie:clock' || item.icon === 'jannchie:crop' ? 'num-tabular text-xs' : undefined
              "
            >
              {{ item.value }}
            </span>
          </div>
        </div>
      </section>
      <WaterfallRecipeCard
        v-if="llrRecipe"
        :title="t('gallery.metadata.llr')"
        :badges="llrBadges"
        :facts="llrRecipe.facts"
        :tone-curve="llrRecipe.toneCurve"
        :tone-curve-bypassed="llrRecipe.toneCurveBypassed"
        :groups="llrRecipe.groups"
        :masks="llrRecipe.masks"
        :masks-bypassed="llrRecipe.masksBypassed"
      />
      <WaterfallRecipeCard
        v-if="lightroomRecipe"
        :title="t('gallery.metadata.lightroom')"
        :badges="lightroomBadges"
        :tone-curve="lightroomRecipe.toneCurve"
        :groups="lightroomRecipe.groups"
      />
    </template>
    <div v-else class="border-b border-border px-5 py-8 text-center text-[13px] text-dimmed">
      {{ t('gallery.metadata.empty') }}
    </div>
  </div>
</template>
