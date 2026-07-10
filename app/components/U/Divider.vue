<script setup lang="ts">
/*
 * Divider — horizontal/vertical 1px rule with optional inline label.
 * The legacy `hatch` variant renders as a solid rule; the prop is kept so
 * old call sites don't break.
 */
defineProps<{
  label?: string
  orientation?: 'horizontal' | 'vertical'
  variant?: 'solid' | 'hatch'
}>()
</script>

<template>
  <div
    v-if="orientation === 'vertical'"
    class="inline-block h-full w-px self-stretch bg-border"
    role="separator"
    aria-orientation="vertical"
  />
  <div
    v-else
    class="flex items-center gap-3"
    role="separator"
  >
    <span class="h-px flex-1 bg-border" />
    <span v-if="label" class="label-caption shrink-0 text-dimmed">{{ label }}</span>
    <span v-if="label" class="h-px flex-1 bg-border" />
  </div>
</template>
