<script setup lang="ts">
/*
 * Page-level header: large display title + optional eyebrow + actions row.
 * Uses generous bottom margin and a hairline divider so admin pages start
 * with a strong typographic anchor instead of a card.
 */
defineProps<{
  eyebrow?: string
  title: string
  description?: string
  icon?: string
}>()
</script>

<template>
  <header class="flex flex-col gap-4 border-b border-[var(--color-border-muted)] pb-6 sm:flex-row sm:items-end sm:justify-between">
    <div class="space-y-2">
      <p v-if="eyebrow" class="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
        <Icon v-if="icon" :name="icon" class="h-3.5 w-3.5" />
        <span>{{ eyebrow }}</span>
      </p>
      <h1 class="text-3xl font-semibold leading-[1.1] tracking-tight text-highlighted">
        {{ title }}
      </h1>
      <p v-if="description" class="max-w-2xl text-sm text-muted">
        {{ description }}
      </p>
    </div>
    <div v-if="$slots.actions" class="flex shrink-0 flex-wrap items-center gap-2">
      <slot name="actions" />
    </div>
  </header>
</template>
