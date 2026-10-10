<script setup lang="ts">
import type { LightroomRecipeView, LlrRecipeView, MetadataEntry, RecipeAdjustmentGroup } from '~/types/gallery'
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

const llrBadges = computed<string[]>(() => {
  const recipe = llrRecipe.value
  if (!recipe) {
    return []
  }
  return [
    recipe.version ? `v${recipe.version}` : null,
    recipe.profile ? `${t('gallery.metadata.llrProfile')}: ${recipe.profile}` : null,
    recipe.dcp ? `${t('gallery.metadata.llrStyle')}: ${recipe.dcp}` : null,
    recipe.lookStyle ? `${t('gallery.metadata.llrLook')}: ${recipe.lookStyle}` : null,
    recipe.dro ? `DRO ${recipe.dro}` : null,
    recipe.denoise ? `${t('gallery.metadata.llrDenoise')}: ${recipe.denoise}` : null,
    recipe.aspect ? `${t('gallery.metadata.llrAspect')}: ${recipe.aspect}` : null,
    recipe.geometry ? `${t('gallery.metadata.llrGeometry')}: ${recipe.geometry}` : null,
    ...recipe.toggles,
    ...recipe.bypass.map(module => `${t('gallery.metadata.llrBypass')}: ${module}`),
  ].filter((badge): badge is string => badge !== null)
})

// The Creative Look's tweaks are a group of their own: they drive Sony's own
// stages rather than the Tone panel's sliders, so they do not belong among the
// global adjustments.
const llrGroups = computed<RecipeAdjustmentGroup[]>(() => {
  const recipe = llrRecipe.value
  if (!recipe) {
    return []
  }
  if (recipe.lookItems.length === 0) {
    return recipe.groups
  }
  return [
    ...recipe.groups,
    { key: 'look', label: t('gallery.metadata.llrLookGroup'), items: recipe.lookItems },
  ]
})

const totalEntryCount = computed<number>(() => {
  const focusCount = focusEntry.value ? 1 : 0
  const cropCount = cropEntry.value ? 1 : 0
  const lightroomCount = lightroomRecipe.value ? 1 : 0
  const llrCount = llrRecipe.value ? 1 : 0
  const cameraLookCount = showCameraLookCard.value ? 1 : 0
  return metadataEntries.value.length + exposureEntries.value.length + focusCount + cropCount + lightroomCount + llrCount + cameraLookCount
})
</script>

<template>
  <!--
    Sections of the viewer's info column, stacked edge to edge and closed by
    one hairline each: the exposure triangle as a strip of cells (like the
    icons site's size scales), then key/value rows, then the recipes.
    Numbers (exposure values, dates, sizes) are set in mono.
  -->
  <div class="text-[13px] text-default">
    <template v-if="hasMetadata">
      <section
        v-if="mainExposureEntries.length > 0 || halfWidthExposureEntries.length > 0"
        class="border-b border-border"
      >
        <p class="label-caption flex items-center gap-1.5 px-5 pt-4 pb-3 text-dimmed">
          <Icon name="jannchie:sliders" class="h-3.5 w-3.5" />
          <span>{{ t('gallery.metadata.exposure') }}</span>
        </p>
        <div
          v-if="mainExposureEntries.length > 0"
          class="grid divide-x divide-border border-t border-border"
          :style="{ gridTemplateColumns: `repeat(${mainExposureEntries.length}, minmax(0, 1fr))` }"
        >
          <div
            v-for="item in mainExposureEntries"
            :key="item.label"
            class="flex min-w-0 flex-col gap-1.5 px-3 py-3"
            :aria-label="`${item.label}: ${item.value}`"
          >
            <span class="label-caption-sm flex items-center gap-1 text-dimmed">
              <Icon :name="item.icon" class="h-3 w-3 shrink-0" />
              <span class="truncate">{{ item.label }}</span>
            </span>
            <span class="truncate font-mono text-[15px] leading-tight text-highlighted">{{ item.value }}</span>
          </div>
        </div>
        <div
          v-if="halfWidthExposureEntries.length > 0"
          class="grid divide-x divide-border border-t border-border"
          :style="{ gridTemplateColumns: `repeat(${halfWidthExposureEntries.length}, minmax(0, 1fr))` }"
        >
          <div
            v-for="item in halfWidthExposureEntries"
            :key="item.label"
            class="flex min-w-0 flex-col gap-1.5 px-3 py-3"
            :aria-label="`${item.label}: ${item.value}`"
          >
            <span class="label-caption-sm flex items-center gap-1 text-dimmed">
              <Icon :name="item.icon" class="h-3 w-3 shrink-0" />
              <span class="truncate">{{ item.label }}</span>
            </span>
            <span class="truncate font-mono text-[15px] leading-tight text-highlighted">{{ item.value }}</span>
          </div>
        </div>
      </section>
      <section
        v-if="focusEntry || cropEntry || showCameraLookCard || metadataEntries.length > 0"
        class="border-b border-border"
      >
        <p class="label-caption flex items-center gap-1.5 px-5 pt-4 pb-3 text-dimmed">
          <Icon name="jannchie:info" class="h-3.5 w-3.5" />
          <span>{{ t('gallery.metadata.section') }} · <span class="font-mono">{{ totalEntryCount }}</span></span>
        </p>
        <div class="divide-y divide-border border-t border-border">
          <!-- The focus row keeps the viewfinder green: it drives the AF box drawn on the photo. -->
          <button
            v-if="focusEntry"
            type="button"
            class="grid w-full gap-1 px-5 py-2.5 text-left outline-none transition-colors hover:bg-focus-point-soft focus-visible:bg-focus-point-soft"
            :class="focusIndicatorActive ? 'bg-focus-point-soft shadow-[inset_2px_0_0_var(--color-focus-point)]' : undefined"
            @mouseenter="handleFocusHover(true)"
            @mouseleave="handleFocusHover(false)"
            @focus="handleFocusHover(true)"
            @blur="handleFocusHover(false)"
            @click="handleFocusToggle"
          >
            <span class="label-caption-sm flex items-center gap-1.5" :class="focusIndicatorActive ? 'text-focus-point' : 'text-dimmed'">
              <Icon :name="focusEntry.icon" class="h-3.5 w-3.5" />
              <span>{{ focusEntry.label }}</span>
            </span>
            <span class="font-mono text-xs leading-relaxed whitespace-pre-line text-highlighted">{{ focusEntry.value }}</span>
          </button>
          <div v-if="cropEntry" class="grid gap-1 px-5 py-2.5">
            <span class="label-caption-sm flex items-center gap-1.5 text-dimmed">
              <Icon :name="cropEntry.icon" class="h-3.5 w-3.5" />
              <span>{{ cropEntry.label }}</span>
            </span>
            <span class="font-mono text-xs leading-relaxed whitespace-pre-line text-highlighted">{{ cropEntry.value }}</span>
          </div>
          <div v-if="showCameraLookCard && cameraLook" class="grid gap-1 px-5 py-2.5">
            <span class="label-caption-sm flex items-center gap-1.5 text-dimmed">
              <Icon name="jannchie:camera" class="h-3.5 w-3.5" />
              <span>{{ t('gallery.metadata.cameraLook') }}</span>
            </span>
            <span class="leading-snug text-highlighted">{{ cameraLook }}</span>
          </div>
          <div
            v-for="item in metadataEntries"
            :key="item.key ?? item.label"
            class="grid gap-1 px-5 py-2.5"
          >
            <span class="label-caption-sm flex items-center gap-1.5 text-dimmed">
              <Icon :name="item.icon" class="h-3.5 w-3.5" />
              <span>{{ item.label }}</span>
            </span>
            <span
              v-if="item.valueIcon"
              class="flex items-center gap-2 leading-snug text-highlighted"
            >
              <BrandIcon :name="item.valueIcon" class="h-[1em] text-highlighted" />
              <span v-if="item.valueIconLabel" class="sr-only">{{ item.valueIconLabel }}</span>
              <span>{{ item.value }}</span>
            </span>
            <!-- Capture time and pixel size are numbers: mono, like the exposure strip. -->
            <span
              v-else
              class="leading-snug whitespace-pre-line text-highlighted"
              :class="item.icon === 'jannchie:clock' || item.icon === 'jannchie:crop' ? 'font-mono text-xs' : undefined"
            >{{ item.value }}</span>
          </div>
        </div>
      </section>
      <WaterfallRecipeCard
        v-if="llrRecipe"
        :title="t('gallery.metadata.llr')"
        :badges="llrBadges"
        :tone-curve="llrRecipe.toneCurve"
        :groups="llrGroups"
        :masks="llrRecipe.masks"
      />
      <WaterfallRecipeCard
        v-if="lightroomRecipe"
        :title="t('gallery.metadata.lightroom')"
        :badges="lightroomBadges"
        :tone-curve="lightroomRecipe.toneCurve"
        :groups="lightroomRecipe.groups"
      />
      <section v-if="secondaryExposureEntries.length > 0" class="space-y-3 border-b border-border px-5 py-4">
        <p class="label-caption flex items-center gap-1.5 text-dimmed">
          <Icon name="jannchie:sliders" class="h-3.5 w-3.5" />
          <span>{{ t('gallery.metadata.exposure') }}</span>
        </p>
        <div class="flex flex-wrap gap-1">
          <span
            v-for="item in secondaryExposureEntries"
            :key="item.label"
            class="inline-flex items-center gap-1 rounded-full border border-border-strong px-[7px] py-px text-xs leading-[18px] text-muted"
            :aria-label="`${item.label}: ${item.value}`"
          >
            <span>{{ item.label }}</span>
            <span class="font-mono text-highlighted">{{ item.value }}</span>
          </span>
        </div>
      </section>
    </template>
    <div v-else class="border-b border-border px-5 py-8 text-center text-[13px] text-dimmed">
      {{ t('gallery.metadata.empty') }}
    </div>
  </div>
</template>
