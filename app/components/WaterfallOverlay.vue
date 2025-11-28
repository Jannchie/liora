<script setup lang="ts">
import type { CSSProperties } from 'vue'
import type { HistogramData } from '~/types/file'
import type { FileLocation, ImageAttrs, MetadataEntry, OverlayStat, ResolvedFile } from '~/types/gallery'
import { onBeforeUnmount, ref, watch } from 'vue'

const {
  file,
  overlayBackgroundStyle,
  overlayImageSrc,
  overlayImageTransformStyle,
  overlayDownloadVisible,
  overlayDownloadLabel,
  overlayDownloadPercent,
  overlayZoomLabel,
  overlayZoomIndicatorVisible,
  overlayStats,
  histogram,
  metadataEntries,
  exposureEntries,
  hasMetadata,
  previewAttrs,
  genreLabel,
  location,
  canEdit = false,
  viewerTouchAction = 'none',
} = defineProps<{
  file: ResolvedFile
  overlayBackgroundStyle: Record<string, string> | null
  overlayImageSrc: string | null
  overlayImageTransformStyle: CSSProperties
  overlayDownloadVisible: boolean
  overlayDownloadLabel: string | null
  overlayDownloadPercent: number | null
  overlayZoomLabel: string
  overlayZoomIndicatorVisible: boolean
  overlayStats: OverlayStat[]
  histogram: HistogramData | null
  metadataEntries: MetadataEntry[]
  exposureEntries: MetadataEntry[]
  hasMetadata: boolean
  previewAttrs?: ImageAttrs
  genreLabel?: string | null
  location?: FileLocation | null
  canEdit?: boolean
  viewerTouchAction?: string
}>()

const emit = defineEmits<{
  (event: 'close'): void
  (event: 'edit'): void
  (event: 'wheel', value: WheelEvent): void
  (event: 'dblclick', value: MouseEvent): void
  (event: 'pointerdown', value: PointerEvent): void
  (event: 'pointermove', value: PointerEvent): void
  (event: 'pointerup', value: PointerEvent): void
  (event: 'pointercancel', value: PointerEvent): void
  (event: 'pointerleave', value: PointerEvent): void
  (event: 'viewerMounted', value: HTMLElement | null): void
}>()

const viewerRef = ref<HTMLElement | null>(null)

const { t } = useI18n()

watch(
  viewerRef,
  (next) => {
    emit('viewerMounted', next)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  emit('viewerMounted', null)
})
</script>

<template>
  <div class="fixed inset-0 z-50" role="dialog" aria-modal="true">
    <div
      v-if="overlayBackgroundStyle"
      class="pointer-events-none absolute inset-0 scale-110 bg-cover bg-center blur-3xl"
      :style="overlayBackgroundStyle"
      aria-hidden="true"
    />
    <div class="absolute inset-0" @click="emit('close')" />
    <div class="relative flex h-full w-full">
      <div class="relative z-10 flex h-full w-full flex-col gap-4 overflow-y-auto bg-default text-default backdrop-blur md:grid md:grid-cols-[minmax(0,2fr)_minmax(280px,360px)] md:gap-0 md:overflow-y-visible">
        <div
          ref="viewerRef"
          class="relative flex min-h-[60vh] w-full shrink-0 items-center justify-center overflow-hidden bg-black md:h-full md:min-h-0"
          :style="{ touchAction: viewerTouchAction }"
          @wheel.prevent="emit('wheel', $event)"
          @dblclick.prevent="emit('dblclick', $event)"
          @pointerdown="emit('pointerdown', $event)"
          @pointermove="emit('pointermove', $event)"
          @pointerup="emit('pointerup', $event)"
          @pointercancel="emit('pointercancel', $event)"
          @pointerleave="emit('pointerleave', $event)"
        >
          <img
            :key="file.id"
            :src="overlayImageSrc || file.previewUrl || file.coverUrl || file.imageUrl"
            :srcset="overlayImageSrc === (previewAttrs?.src ?? '') ? previewAttrs?.srcset : undefined"
            :sizes="overlayImageSrc === (previewAttrs?.src ?? '') ? previewAttrs?.sizes : undefined"
            crossorigin="anonymous"
            :width="file.width"
            :height="file.height"
            :style="overlayImageTransformStyle"
            :alt="file.displayTitle"
            loading="eager"
            class="h-auto w-full select-none object-contain md:max-h-screen"
          >
          <Transition
            appear
            enter-active-class="transition duration-200 ease-out"
            leave-active-class="transition duration-200 ease-in"
            enter-from-class="opacity-0 translate-y-1"
            enter-to-class="opacity-100 translate-y-0"
            leave-from-class="opacity-100 translate-y-0"
            leave-to-class="opacity-0 translate-y-1"
          >
            <OverlayDownloadBadge
              v-if="overlayDownloadVisible"
              :visible="true"
              :label="overlayDownloadLabel"
              :percent="overlayDownloadPercent"
            />
          </Transition>
          <Transition
            appear
            enter-active-class="transition duration-150 ease-out"
            leave-active-class="transition duration-150 ease-in"
            enter-from-class="opacity-0 translate-y-1"
            enter-to-class="opacity-100 translate-y-0"
            leave-from-class="opacity-100 translate-y-0"
            leave-to-class="opacity-0 translate-y-1"
          >
            <div
              v-if="overlayZoomIndicatorVisible"
              class="home-display-font pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-md bg-black/70 px-3 py-1 text-[11px] font-semibold text-white ring-1 ring-white/10 backdrop-blur"
            >
              {{ overlayZoomLabel }}
            </div>
          </Transition>
        </div>
        <div class="home-display-font flex min-h-0 flex-col gap-4 p-3 md:border-l md:border-default/20 md:p-4 md:overflow-y-auto">
          <div class="space-y-2.5">
            <div class="flex items-start justify-between gap-3">
              <div class="space-y-1">
                <h3 class="home-title-font text-lg font-semibold leading-snug text-highlighted">
                  {{ file.displayTitle }}
                </h3>
              </div>
              <div class="flex items-center gap-2">
                <button
                  v-if="canEdit"
                  type="button"
                  class="flex items-center gap-2 rounded-md px-3 py-1 text-sm text-primary ring-1 ring-primary/30 transition hover:bg-primary/10"
                  @click="emit('edit')"
                >
                  <Icon name="mdi:cog-outline" class="h-4 w-4" />
                  <span>{{ t('common.actions.edit') }}</span>
                </button>
                <button
                  type="button"
                  class="flex items-center gap-2 rounded-md px-3 py-1 text-sm text-default ring-1 ring-default transition hover:bg-muted"
                  @click="emit('close')"
                >
                  <Icon name="carbon:close" class="h-4 w-4" />
                  <span>{{ t('common.actions.close') }}</span>
                </button>
              </div>
            </div>
            <div class="flex flex-wrap items-center gap-2 text-[11px] font-medium text-muted">
              <div
                v-for="stat in overlayStats"
                :key="`${stat.icon}-${stat.label}`"
                class="inline-flex items-center gap-1 rounded bg-elevated/80 px-2 py-1 text-highlighted ring-1 ring-default/30"
              >
                <Icon :name="stat.icon" class="h-3.5 w-3.5" />
                <span class="leading-none">{{ stat.label }}</span>
              </div>
            </div>
            <div v-if="genreLabel" class="flex items-center gap-2">
              <span class="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary ring-1 ring-primary/20">
                <Icon name="carbon:classification" class="h-3.5 w-3.5" />
                <span>{{ genreLabel }}</span>
              </span>
            </div>
          </div>
          <div class="space-y-3">
            <WaterfallHistogramPanel :histogram="histogram" />
            <WaterfallLocationMap v-if="location" :location="location" />
            <WaterfallMetadataPanel
              :metadata-entries="metadataEntries"
              :exposure-entries="exposureEntries"
              :has-metadata="hasMetadata"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
