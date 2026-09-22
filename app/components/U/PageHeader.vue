<script setup lang="ts">
/*
 * Page-level header: a title and optional description, with actions
 * pinned to the top right.
 */
defineProps<{
  /** Display title (title stack). */
  title?: string
  /** Optional description below the title (prose). */
  description?: string
}>()
</script>

<template>
  <header class="flex flex-col gap-4 pb-2">
    <div v-if="$slots.actions" class="flex flex-wrap items-center justify-end gap-2">
      <slot name="actions" />
    </div>
    <div v-if="title || description" class="space-y-2">
      <h1 v-if="title" class="font-title text-3xl font-semibold leading-[1.15] text-highlighted">
        {{ title }}
      </h1>
      <p v-if="description" class="font-prose max-w-2xl text-sm text-muted">
        {{ description }}
      </p>
    </div>
  </header>
</template>
