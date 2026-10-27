<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  visible: boolean
  label: string | null
  percent: number | null
}>()

const safePercent = computed<number | null>(() => {
  if (typeof props.percent !== 'number' || !Number.isFinite(props.percent)) {
    return null
  }
  return Math.min(100, Math.max(0, Math.round(props.percent)))
})
</script>

<template>
  <!-- Sits on the photo, so it keeps the dark translucent overlay bar; the
       percentage is mono and the progress is a 2px track. -->
  <div
    v-if="visible && label"
    class="pointer-events-none absolute bottom-4 right-4 z-40 min-w-40 max-w-[320px] rounded-md border border-white/15 bg-black/75 px-3.5 py-3 text-[13px] text-white backdrop-blur-sm"
  >
    <div class="flex items-center justify-between gap-3">
      <div class="flex min-w-0 items-center gap-2">
        <Icon name="jannchie:download" class="h-4 w-4 shrink-0 text-white/70" />
        <span class="truncate font-medium">{{ label }}</span>
      </div>
      <span v-if="safePercent !== null" class="num-tabular text-xs text-white/80"> {{ safePercent }}% </span>
    </div>
    <div v-if="safePercent !== null" class="mt-2.5 h-0.5 bg-white/20">
      <div class="h-full bg-white" :style="{ width: `${safePercent}%` }" />
    </div>
  </div>
</template>
