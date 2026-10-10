<script setup lang="ts">
/*
 * Page-level header — the first band of a page: title on the left (the
 * icons site's category heading: 18–20px semibold, tight tracking), an
 * optional description under it, actions on the right. Closed by a
 * hairline like every other band.
 */
defineProps<{
  /** Display title (title stack). */
  title?: string
  /** Optional description below the title (prose). */
  description?: string
}>()
</script>

<template>
  <header class="wire-band flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div v-if="title || description" class="min-w-0 space-y-1.5">
      <h1 v-if="title" class="font-title text-xl font-semibold leading-tight tracking-[-0.01em] text-highlighted">
        {{ title }}
      </h1>
      <p v-if="description" class="font-prose max-w-2xl text-[13px] leading-relaxed text-dimmed">
        {{ description }}
      </p>
    </div>
    <div v-if="$slots.actions" class="flex shrink-0 flex-wrap items-center gap-1.5">
      <slot name="actions" />
    </div>
  </header>
</template>
