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
    recipe.denoise ? `${t('gallery.metadata.llrDenoise')}: ${recipe.denoise}` : null,
    recipe.aspect ? `${t('gallery.metadata.llrAspect')}: ${recipe.aspect}` : null,
  ].filter((badge): badge is string => badge !== null)
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
  <div class="rounded-lg border border-default/20 bg-elevated/80 text-sm text-default">
    <div class="flex items-center justify-between border-b border-default/10 px-3 py-2 text-xs font-medium text-muted">
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
        <div class="flex items-center gap-2 text-xs font-medium text-muted">
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
              <span class="label-caption-sm">{{ item.label }}</span>
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
              <span class="label-caption-sm">{{ item.label }}</span>
              <span class="text-base font-semibold text-highlighted">{{ item.value }}</span>
            </div>
          </div>
        </div>
      </div>
      <div v-if="focusEntry || cropEntry || lightroomRecipe || llrRecipe || showCameraLookCard || metadataEntries.length > 0" class="space-y-2">
        <button
          v-if="focusEntry"
          type="button"
          class="grid w-full gap-1 rounded-md bg-default/60 px-2 py-2 text-left ring-1 ring-default/15 transition-colors hover:bg-focus-point/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-point/60"
          :class="focusIndicatorActive ? 'bg-focus-point/10 ring-focus-point/40' : undefined"
          @mouseenter="handleFocusHover(true)"
          @mouseleave="handleFocusHover(false)"
          @focus="handleFocusHover(true)"
          @blur="handleFocusHover(false)"
          @click="handleFocusToggle"
        >
          <p class="flex items-center gap-2 text-xs font-medium text-muted">
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
          <p class="flex items-center gap-2 text-xs font-medium text-muted">
            <Icon :name="cropEntry.icon" class="h-4 w-4" />
            <span>{{ cropEntry.label }}</span>
          </p>
          <p class="text-sm leading-snug whitespace-pre-line text-highlighted">
            {{ cropEntry.value }}
          </p>
        </div>
        <WaterfallRecipeCard
          v-if="llrRecipe"
          :title="t('gallery.metadata.llr')"
          :badges="llrBadges"
          :tone-curve="llrRecipe.toneCurve"
          :groups="llrRecipe.groups"
        />
        <WaterfallRecipeCard
          v-if="lightroomRecipe"
          :title="t('gallery.metadata.lightroom')"
          :badges="lightroomBadges"
          :tone-curve="lightroomRecipe.toneCurve"
          :groups="lightroomRecipe.groups"
        />
        <div
          v-if="showCameraLookCard && cameraLook"
          class="grid gap-1 rounded-md bg-default/60 px-2 py-2 ring-1 ring-default/15"
        >
          <p class="flex items-center gap-2 text-xs font-medium text-muted">
            <Icon name="tabler:camera" class="h-4 w-4" />
            <span>{{ t('gallery.metadata.cameraLook') }}</span>
          </p>
          <p class="text-sm leading-snug text-highlighted">
            {{ cameraLook }}
          </p>
        </div>
        <div
          v-for="item in metadataEntries"
          :key="item.key ?? item.label"
          class="grid gap-1 rounded-md bg-default/60 px-2 py-2 ring-1 ring-default/15"
        >
          <p class="flex items-center gap-2 text-xs font-medium text-muted">
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
        <div class="flex items-center gap-2 text-xs font-medium text-muted">
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
      <p class="flex items-center gap-2 text-xs font-medium text-muted">
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
