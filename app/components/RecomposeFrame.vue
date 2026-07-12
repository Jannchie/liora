<script setup lang="ts">
import type { CSSProperties } from 'vue'
import type { RecomposeParams } from '#shared/types/recompose'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { computeRecomposePlane, recomposeCssMatrix } from '#shared/utils/recompose'

const props = withDefaults(
  defineProps<{
    /** Null renders the slot untransformed, so callers don't need their own branch. */
    params?: RecomposeParams | null
    /** clip: hard-crop to the frame (grid). reveal: also render the original beyond the frame (lightbox). */
    mode?: 'clip' | 'reveal'
    /** reveal only: whether the beyond-frame content is currently shown (e.g. viewer zoomed out). */
    revealActive?: boolean
  }>(),
  {
    params: null,
    mode: 'clip',
    revealActive: true,
  },
)

const frameEl = ref<HTMLElement | null>(null)
const frameWidth = ref(0)
let observer: ResizeObserver | null = null

onMounted(() => {
  observer = new ResizeObserver((entries) => {
    const entry = entries[0]
    if (entry) {
      frameWidth.value = entry.contentRect.width
    }
  })
  if (frameEl.value) {
    frameWidth.value = frameEl.value.clientWidth
    observer.observe(frameEl.value)
  }
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})

/**
 * Like an <img>, the frame must have an intrinsic ratio: grid cells and other
 * hosts derive their height from the content, and a bare div would collapse
 * to zero. aspect-ratio only kicks in when a dimension is auto, so hosts that
 * size the frame explicitly are unaffected.
 */
const frameStyle = computed<CSSProperties | null>(() => {
  if (!props.params) {
    return null
  }
  const plane = computeRecomposePlane(props.params)
  return {
    aspectRatio: `${props.params.crop.width * plane.planeWidth} / ${props.params.crop.height * plane.planeHeight}`,
  }
})

const wrapperStyle = computed<CSSProperties | null>(() => {
  if (!props.params || frameWidth.value <= 0) {
    return null
  }
  const plane = computeRecomposePlane(props.params)
  const cropPlaneWidth = props.params.crop.width * plane.planeWidth
  const k = frameWidth.value / cropPlaneWidth
  return {
    position: 'absolute',
    left: '0',
    top: '0',
    width: `${props.params.original.width * k}px`,
    height: `${props.params.original.height * k}px`,
    transform: recomposeCssMatrix(props.params, k),
    transformOrigin: '0 0',
    willChange: 'transform',
  }
})
</script>

<template>
  <div ref="frameEl" class="relative h-full w-full" :style="frameStyle">
    <template v-if="params">
      <div
        v-if="mode === 'reveal' && wrapperStyle"
        class="pointer-events-none absolute inset-0"
        style="overflow: visible"
        aria-hidden="true"
      >
        <div
          class="transition-opacity duration-200"
          :style="[wrapperStyle, { opacity: revealActive ? 1 : 0 }]"
        >
          <slot name="backdrop" />
        </div>
      </div>
      <div class="absolute inset-0 overflow-hidden">
        <div v-if="wrapperStyle" :style="wrapperStyle">
          <slot />
        </div>
      </div>
    </template>
    <div v-else class="absolute inset-0">
      <slot />
    </div>
  </div>
</template>
