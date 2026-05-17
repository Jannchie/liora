<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  arthashReady,
  decodeArthashToAnimatedSvg,
  ensureArthashReady,
} from '~/utils/arthash'

const props = withDefaults(
  defineProps<{
    arthash?: string | null
    loaded: boolean
    fadeDurationMs?: number
    staggerMs?: number
  }>(),
  {
    arthash: null,
    fadeDurationMs: 140,
    staggerMs: 14,
  },
)

const rendered = computed(() => {
  void arthashReady.value
  return decodeArthashToAnimatedSvg(props.arthash ?? undefined, {
    fadeDurationMs: props.fadeDurationMs,
    staggerMs: props.staggerMs,
  })
})

// Track whether the SVG has been visible to the user for at least one paint.
// Without this, an image that's already in the browser cache marks itself
// loaded before the SVG ever appears, and we either flash the placeholder for
// a fraction of a second or skip the animation. We prefer to skip cleanly.
const wasVisible = ref(false)
const removed = ref(false)
let removalTimer: ReturnType<typeof setTimeout> | null = null

function clearTimer(): void {
  if (removalTimer) {
    clearTimeout(removalTimer)
    removalTimer = null
  }
}

watch(
  () => Boolean(rendered.value) && !props.loaded,
  (visible) => {
    if (visible) {
      wasVisible.value = true
    }
  },
  { immediate: true },
)

watch(
  () => props.loaded,
  (loaded) => {
    clearTimer()
    if (!loaded) {
      removed.value = false
      return
    }
    if (!wasVisible.value) {
      // Image was already cached / decoded before the placeholder ever
      // rendered — no animation to run.
      removed.value = true
      return
    }
    const total = rendered.value?.totalDurationMs ?? 600
    // +60ms cushion so the last rect finishes before we unmount the SVG.
    removalTimer = setTimeout(() => {
      removed.value = true
    }, total + 60)
  },
  { immediate: true },
)

watch(rendered, (next, prev) => {
  if (prev?.svg === next?.svg) {
    return
  }
  removed.value = false
})

onMounted(() => {
  void ensureArthashReady()
})

onBeforeUnmount(() => {
  clearTimer()
})
</script>

<template>
  <div
    v-if="rendered && !removed"
    class="arthash-placeholder pointer-events-none absolute inset-0"
    :class="{ 'is-loaded': loaded }"
    aria-hidden="true"
    v-html="rendered.svg"
  />
</template>

<style scoped>
.arthash-placeholder {
  contain: paint;
}

.arthash-placeholder :deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
}

.arthash-placeholder.is-loaded :deep(rect),
.arthash-placeholder.is-loaded :deep(path) {
  opacity: 0;
}
</style>
