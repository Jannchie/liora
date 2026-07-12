<script setup lang="ts">
import type { RecomposeCropRect } from '#shared/types/recompose'
import { computed, ref } from 'vue'

const props = defineProps<{
  crop: RecomposeCropRect
  planeWidth: number
  planeHeight: number
  /** CSS pixels per plane pixel on the editor stage. */
  scale: number
  /** Locked crop aspect (width/height in plane pixels), null = free. */
  lockedAspect: number | null
}>()

const emit = defineEmits<{
  (event: 'update:crop', value: RecomposeCropRect): void
  (event: 'dragEnd'): void
}>()

type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

const MIN_CROP_SIZE = 0.05

interface DragState {
  pointerId: number
  kind: 'move' | HandleId
  startX: number
  startY: number
  origin: RecomposeCropRect
}

const drag = ref<DragState | null>(null)

const rectStyle = computed(() => ({
  left: `${props.crop.x * props.planeWidth * props.scale}px`,
  top: `${props.crop.y * props.planeHeight * props.scale}px`,
  width: `${props.crop.width * props.planeWidth * props.scale}px`,
  height: `${props.crop.height * props.planeHeight * props.scale}px`,
}))

const cornerHandles: Array<{ id: HandleId, class: string, cursor: string }> = [
  { id: 'nw', class: 'left-0 top-0 -translate-x-1/2 -translate-y-1/2', cursor: 'nwse-resize' },
  { id: 'ne', class: 'right-0 top-0 translate-x-1/2 -translate-y-1/2', cursor: 'nesw-resize' },
  { id: 'se', class: 'bottom-0 right-0 translate-x-1/2 translate-y-1/2', cursor: 'nwse-resize' },
  { id: 'sw', class: 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2', cursor: 'nesw-resize' },
]

const edgeHandles: Array<{ id: HandleId, class: string, cursor: string }> = [
  { id: 'n', class: 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2', cursor: 'ns-resize' },
  { id: 'e', class: 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2', cursor: 'ew-resize' },
  { id: 's', class: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2', cursor: 'ns-resize' },
  { id: 'w', class: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2', cursor: 'ew-resize' },
]

function startDrag(event: PointerEvent, kind: DragState['kind']): void {
  event.preventDefault()
  event.stopPropagation()
  const target = event.currentTarget as HTMLElement
  target.setPointerCapture(event.pointerId)
  drag.value = {
    pointerId: event.pointerId,
    kind,
    startX: event.clientX,
    startY: event.clientY,
    origin: { ...props.crop },
  }
}

function resize(origin: RecomposeCropRect, kind: HandleId, dx: number, dy: number): RecomposeCropRect {
  let { x, y, width, height } = origin
  const right = x + width
  const bottom = y + height

  if (kind.includes('w')) {
    x = Math.min(right - MIN_CROP_SIZE, x + dx)
    width = right - x
  }
  if (kind.includes('e')) {
    width = Math.max(MIN_CROP_SIZE, width + dx)
  }
  if (kind.includes('n')) {
    y = Math.min(bottom - MIN_CROP_SIZE, y + dy)
    height = bottom - y
  }
  if (kind.includes('s')) {
    height = Math.max(MIN_CROP_SIZE, height + dy)
  }

  const aspect = props.lockedAspect
  if (aspect && kind.length === 2) {
    // Corner drag with a locked aspect: derive height from width (in plane px),
    // anchoring the opposite corner.
    const planeAspect = props.planeWidth / props.planeHeight
    const normalizedAspect = aspect / planeAspect
    height = width / normalizedAspect
    if (kind.includes('n')) {
      y = bottom - height
    }
  }

  return { x, y, width, height }
}

function handlePointerMove(event: PointerEvent): void {
  const state = drag.value
  if (!state || state.pointerId !== event.pointerId) {
    return
  }
  event.preventDefault()
  const dx = (event.clientX - state.startX) / (props.planeWidth * props.scale)
  const dy = (event.clientY - state.startY) / (props.planeHeight * props.scale)
  // The editor's setCrop clamps into the unit square, so raw rects are fine here.
  if (state.kind === 'move') {
    emit('update:crop', {
      ...state.origin,
      x: state.origin.x + dx,
      y: state.origin.y + dy,
    })
    return
  }
  emit('update:crop', resize(state.origin, state.kind, dx, dy))
}

function endDrag(event: PointerEvent): void {
  const state = drag.value
  if (!state || state.pointerId !== event.pointerId) {
    return
  }
  drag.value = null
  emit('dragEnd')
}
</script>

<template>
  <div class="absolute inset-0">
    <div
      class="absolute cursor-move touch-none"
      :style="[rectStyle, { boxShadow: '0 0 0 100000px rgb(0 0 0 / 0.55)' }]"
      @pointerdown="startDrag($event, 'move')"
      @pointermove="handlePointerMove"
      @pointerup="endDrag"
      @pointercancel="endDrag"
    >
      <div class="pointer-events-none absolute inset-0 border border-white/90" />
      <!-- Rule-of-thirds grid -->
      <div class="pointer-events-none absolute inset-y-0 left-1/3 w-px bg-white/30" />
      <div class="pointer-events-none absolute inset-y-0 left-2/3 w-px bg-white/30" />
      <div class="pointer-events-none absolute inset-x-0 top-1/3 h-px bg-white/30" />
      <div class="pointer-events-none absolute inset-x-0 top-2/3 h-px bg-white/30" />
      <div
        v-for="handle in cornerHandles"
        :key="handle.id"
        class="absolute h-3 w-3 touch-none border border-black/40 bg-white"
        :class="handle.class"
        :style="{ cursor: handle.cursor }"
        @pointerdown="startDrag($event, handle.id)"
        @pointermove="handlePointerMove"
        @pointerup="endDrag"
        @pointercancel="endDrag"
      />
      <template v-if="!lockedAspect">
        <div
          v-for="handle in edgeHandles"
          :key="handle.id"
          class="absolute h-2.5 w-2.5 touch-none rounded-full border border-black/40 bg-white"
          :class="handle.class"
          :style="{ cursor: handle.cursor }"
          @pointerdown="startDrag($event, handle.id)"
          @pointermove="handlePointerMove"
          @pointerup="endDrag"
          @pointercancel="endDrag"
        />
      </template>
    </div>
  </div>
</template>
