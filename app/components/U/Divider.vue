<script setup lang="ts">
defineProps<{
  label?: string
  orientation?: 'horizontal' | 'vertical'
}>()
</script>

<template>
  <div
    v-if="orientation === 'vertical'"
    class="inline-block h-full w-px self-stretch bg-[var(--color-border)]"
    role="separator"
    aria-orientation="vertical"
  />
  <div
    v-else
    class="flex items-center gap-3"
    role="separator"
  >
    <span class="h-px flex-1 bg-[var(--color-border)]" />
    <span v-if="label" class="text-xs uppercase tracking-wide text-muted">{{ label }}</span>
    <span v-if="label" class="h-px flex-1 bg-[var(--color-border)]" />
  </div>
</template>
