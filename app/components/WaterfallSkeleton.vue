<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    columns?: number
    rows?: number
  }>(),
  {
    columns: 2,
    rows: 4,
  },
)

const items = computed(() => {
  const result: { id: number, heightPercent: number }[] = []
  const ratios = [120, 160, 100, 140, 130, 110, 150, 90]
  for (let i = 0; i < props.columns * props.rows; i++) {
    result.push({
      id: i,
      heightPercent: ratios[i % ratios.length] ?? 120,
    })
  }
  return result
})
</script>

<template>
  <div class="grid gap-1" :style="{ gridTemplateColumns: `repeat(${columns}, 1fr)` }">
    <div
      v-for="item in items"
      :key="item.id"
      class="animate-pulse rounded-sm bg-elevated/60"
      :style="{ height: `${item.heightPercent}px` }"
    />
  </div>
</template>
