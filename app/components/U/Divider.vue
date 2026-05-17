<script setup lang="ts">
/*
 * Divider — horizontal/vertical 1px rule with optional inline label.
 *
 * Variants:
 *   - default: solid hairline
 *   - hatch:   diagonal stripes (telemetry edge marker)
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
    class="inline-block h-full self-stretch"
    :class="variant === 'hatch' ? 'w-2 bg-hatch' : 'w-px bg-[var(--color-border)]'"
    role="separator"
    aria-orientation="vertical"
  />
  <div
    v-else
    class="flex items-center gap-3"
    role="separator"
  >
    <span
      class="flex-1"
      :class="variant === 'hatch' ? 'h-2 bg-hatch' : 'h-px bg-[var(--color-border)]'"
    />
    <span v-if="label" class="label-mono shrink-0 text-dimmed">{{ label }}</span>
    <span
      v-if="label"
      class="flex-1"
      :class="variant === 'hatch' ? 'h-2 bg-hatch' : 'h-px bg-[var(--color-border)]'"
    />
  </div>
</template>
