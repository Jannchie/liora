<script setup lang="ts">
import type { CSSProperties } from 'vue'
import { computed, nextTick, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    src?: string | null
    alt: string
    width: number
    height: number
    ariaLabel?: string
  }>(),
  {
    src: null,
    ariaLabel: undefined,
  },
)

const emit = defineEmits<{
  (event: 'update:open', value: boolean): void
}>()

const viewerRef = ref<HTMLElement | null>(null)
const zoom = ref<number>(1)
const pan = ref<{ x: number, y: number }>({ x: 0, y: 0 })
const zoomStep = 0.2
const zoomEpsilon = 0.001
const zoomMaxFactor = 5
const dragState = ref<{
  pointerId: number | null
  startX: number
  startY: number
  originX: number
  originY: number
}>({
  pointerId: null,
  startX: 0,
  startY: 0,
  originX: 0,
  originY: 0,
})
const pointers = ref<Map<number, { x: number, y: number }>>(new Map())
const pinchBase = ref<{ distance: number, zoom: number } | null>(null)

const resolvedSrc = computed<string | null>(() => {
  const trimmed = props.src?.trim() ?? ''
  return trimmed.length > 0 ? trimmed : null
})

const baseScale = computed<number>(() => {
  const viewer = viewerRef.value
  const width = props.width
  const height = props.height
  if (!viewer || !Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    return 1
  }
  const rect = viewer.getBoundingClientRect()
  if (!Number.isFinite(rect.width) || rect.width <= 0 || !Number.isFinite(rect.height) || rect.height <= 0) {
    return 1
  }
  const scale = Math.min(rect.width / width, rect.height / height)
  return Number.isFinite(scale) && scale > 0 ? scale : 1
})

const zoomMin = computed<number>(() => Math.max(zoomEpsilon, baseScale.value))
const zoomMax = computed<number>(() => Math.max(zoomMin.value * zoomMaxFactor, zoomMaxFactor))

const imageTransformStyle = computed<CSSProperties>(() => ({
  transform: `translate3d(${pan.value.x}px, ${pan.value.y}px, 0) scale(${zoom.value})`,
  transformOrigin: 'center',
  willChange: 'transform',
}))

const cursorClass = computed(() => {
  if (zoom.value > zoomMin.value + zoomEpsilon) {
    return 'cursor-grab'
  }
  return 'cursor-zoom-in'
})

const { t } = useI18n()

watch(
  () => props.open,
  async (open) => {
    if (!open || !resolvedSrc.value) {
      return
    }
    await nextTick()
    resetTransform()
  },
)

watch(
  resolvedSrc,
  async (next) => {
    if (!props.open || !next) {
      return
    }
    await nextTick()
    resetTransform()
  },
)

watch(
  baseScale,
  (nextBase) => {
    if (!props.open || !Number.isFinite(nextBase) || nextBase <= 0) {
      return
    }
    if (zoom.value < nextBase - zoomEpsilon) {
      zoom.value = nextBase
      pan.value = { x: 0, y: 0 }
    }
  },
)

function close(): void {
  emit('update:open', false)
}

function resetTransform(): void {
  zoom.value = zoomMin.value
  pan.value = { x: 0, y: 0 }
  pinchBase.value = null
  pointers.value.clear()
  dragState.value = {
    pointerId: null,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  }
}

function computePanForFocus(point: { clientX: number, clientY: number }, targetZoom: number): {
  x: number
  y: number
} | null {
  const viewer = viewerRef.value
  const base = baseScale.value
  if (!viewer || !Number.isFinite(targetZoom) || targetZoom <= 0 || !Number.isFinite(base) || base <= 0) {
    return null
  }
  const currentScale = zoom.value / base
  const nextScale = targetZoom / base
  if (!Number.isFinite(currentScale) || currentScale <= 0 || !Number.isFinite(nextScale) || nextScale <= 0) {
    return null
  }
  const ratio = nextScale / currentScale
  const rect = viewer.getBoundingClientRect()
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2
  const dx = point.clientX - centerX
  const dy = point.clientY - centerY
  return {
    x: pan.value.x - (dx - pan.value.x) * (ratio - 1),
    y: pan.value.y - (dy - pan.value.y) * (ratio - 1),
  }
}

function setZoom(next: number, focalPoint?: { clientX: number, clientY: number }): void {
  const minZoom = zoomMin.value
  const maxZoom = zoomMax.value
  const clamped = Math.min(maxZoom, Math.max(minZoom, next))
  if (clamped === zoom.value) {
    return
  }
  let nextPan = pan.value
  if (clamped <= minZoom + zoomEpsilon) {
    nextPan = { x: 0, y: 0 }
  }
  else if (focalPoint) {
    const focusedPan = computePanForFocus(focalPoint, clamped)
    if (focusedPan) {
      nextPan = focusedPan
    }
  }
  zoom.value = clamped
  pan.value = nextPan
}

function handleWheel(event: WheelEvent): void {
  event.preventDefault()
  const direction = event.deltaY > 0 ? -zoomStep : zoomStep
  setZoom(zoom.value + direction, { clientX: event.clientX, clientY: event.clientY })
}

function handleDoubleClick(event: MouseEvent): void {
  event.preventDefault()
  const minZoom = zoomMin.value
  const zoomInTarget = Math.min(zoomMax.value, Math.max(1, minZoom * 2))
  const target = zoom.value > minZoom + zoomEpsilon ? minZoom : zoomInTarget
  const focal = target > minZoom + zoomEpsilon
    ? { clientX: event.clientX, clientY: event.clientY }
    : undefined
  setZoom(target, focal)
}

function handlePointerDown(event: PointerEvent): void {
  if (!(event.currentTarget instanceof HTMLElement)) {
    return
  }
  pointers.value.set(event.pointerId, { x: event.clientX, y: event.clientY })

  if (pointers.value.size >= 2) {
    event.preventDefault()
    const points = [...pointers.value.values()]
    const first = points[0]
    const second = points[1]
    if (!first || !second) {
      return
    }
    const distance = Math.hypot(second.x - first.x, second.y - first.y)
    pinchBase.value = {
      distance: Math.max(distance, 0),
      zoom: zoom.value,
    }
    dragState.value = {
      pointerId: null,
      startX: 0,
      startY: 0,
      originX: 0,
      originY: 0,
    }
    return
  }

  if (zoom.value <= zoomMin.value + zoomEpsilon) {
    dragState.value = {
      pointerId: null,
      startX: 0,
      startY: 0,
      originX: 0,
      originY: 0,
    }
    return
  }

  event.preventDefault()
  event.currentTarget.setPointerCapture(event.pointerId)
  dragState.value = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    originX: pan.value.x,
    originY: pan.value.y,
  }
}

function handlePointerMove(event: PointerEvent): void {
  if (pointers.value.has(event.pointerId)) {
    pointers.value.set(event.pointerId, { x: event.clientX, y: event.clientY })
  }

  if (pointers.value.size >= 2 && pinchBase.value) {
    const points = [...pointers.value.values()]
    const first = points[0]
    const second = points[1]
    if (!first || !second) {
      return
    }
    const distance = Math.hypot(second.x - first.x, second.y - first.y)
    if (distance > 0 && pinchBase.value.distance > 0) {
      const centerX = (first.x + second.x) / 2
      const centerY = (first.y + second.y) / 2
      const ratio = distance / pinchBase.value.distance
      const nextZoom = Math.min(zoomMax.value, Math.max(zoomMin.value, pinchBase.value.zoom * ratio))
      setZoom(nextZoom, { clientX: centerX, clientY: centerY })
    }
    return
  }

  const state = dragState.value
  if (state.pointerId === null || state.pointerId !== event.pointerId) {
    return
  }
  const deltaX = event.clientX - state.startX
  const deltaY = event.clientY - state.startY
  pan.value = {
    x: state.originX + deltaX,
    y: state.originY + deltaY,
  }
}

function endPointer(event: PointerEvent): void {
  if (pointers.value.has(event.pointerId)) {
    pointers.value.delete(event.pointerId)
  }
  if (pointers.value.size < 2) {
    pinchBase.value = null
  }

  if (event.currentTarget instanceof HTMLElement) {
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const state = dragState.value
  if (state.pointerId === null || state.pointerId !== event.pointerId) {
    return
  }
  dragState.value = {
    pointerId: null,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  }
}
</script>

<template>
  <Transition
    enter-active-class="transition duration-150 ease-out"
    leave-active-class="transition duration-150 ease-in"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="open && resolvedSrc"
      class="fixed inset-0 z-60 bg-black/90"
      role="dialog"
      aria-modal="true"
      :aria-label="ariaLabel"
      @click.self="close"
    >
      <UButton
        type="button"
        size="sm"
        color="neutral"
        variant="ghost"
        icon="tabler:x"
        :aria-label="t('common.actions.close')"
        class="absolute right-3 top-3 z-10 text-white"
        @click="close"
      />
      <div
        ref="viewerRef"
        :class="cursorClass"
        class="relative z-0 flex h-full w-full items-center justify-center overflow-hidden p-3 touch-none"
        @wheel.prevent="handleWheel"
        @dblclick.prevent="handleDoubleClick"
        @pointerdown="handlePointerDown"
        @pointermove="handlePointerMove"
        @pointerup="endPointer"
        @pointercancel="endPointer"
        @pointerleave="endPointer"
      >
        <img
          :src="resolvedSrc"
          :alt="alt"
          :width="width"
          :height="height"
          :style="imageTransformStyle"
          loading="eager"
          draggable="false"
          class="max-h-none max-w-none select-none"
        >
      </div>
    </div>
  </Transition>
</template>
