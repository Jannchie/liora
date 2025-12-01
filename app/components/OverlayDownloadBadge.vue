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
  <div
    v-if="visible && label"
    class="home-display-font pointer-events-none absolute bottom-4 right-4 min-w-40 max-w-[320px] rounded-md border border-white/10 bg-black/80 px-3.5 py-3 text-xs text-white backdrop-blur-sm ring-1 ring-white/5"
  >
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-center gap-2">
        <Icon name="mdi:download" class="h-4 w-4 text-white/70" />
        <span class="font-semibold">{{ label }}</span>
      </div>
      <span v-if="safePercent !== null" class="text-xs font-semibold text-white/80">
        {{ safePercent }}%
      </span>
    </div>
    <div v-if="safePercent !== null" class="mt-2 h-px rounded-full bg-white/20">
      <div
        class="h-full rounded-full bg-white/70"
        :style="{ width: `${safePercent}%` }"
      />
    </div>
  </div>
</template>
