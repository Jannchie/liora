<script setup lang="ts">
/*
 * Page-level header — telemetry style.
 *
 * Layout: `EYEBROW / SUBTITLE          • SYNC chip       <actions>`
 * Below: large title (display font) + optional description.
 *
 * Why two type families: the eyebrow row is mono uppercase (system chrome)
 * while the H1 stays in the display sans for legibility on the gallery
 * pages, where the title is a real reading anchor.
 */
defineProps<{
  /** Top-left chrome label. Rendered in mono uppercase. */
  eyebrow?: string
  /** Optional subtitle joined with `/`. Use for "AGENT·TIME / TELEMETRY". */
  subtitle?: string
  /** Display title (sans). */
  title?: string
  /** Optional description below the title (prose, sans). */
  description?: string
  /** Icon glyph for the eyebrow row. */
  icon?: string
}>()
</script>

<template>
  <header class="flex flex-col gap-4 pb-2">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex min-w-0 flex-wrap items-center gap-2">
        <p v-if="eyebrow" class="label-mono flex items-center gap-1.5 text-foreground">
          <Icon v-if="icon" :name="icon" class="h-3.5 w-3.5" />
          <span>{{ eyebrow }}</span>
        </p>
        <span v-if="subtitle" class="label-mono flex items-center gap-2 text-dimmed">
          <span aria-hidden="true">/</span>
          <span>{{ subtitle }}</span>
        </span>
        <div v-if="$slots.eyebrowMeta" class="flex items-center gap-2">
          <slot name="eyebrowMeta" />
        </div>
      </div>
      <div v-if="$slots.actions" class="flex shrink-0 flex-wrap items-center gap-2">
        <slot name="actions" />
      </div>
    </div>
    <div v-if="title || description" class="space-y-2">
      <h1 v-if="title" class="font-prose text-3xl font-semibold leading-[1.1] tracking-tight text-highlighted">
        {{ title }}
      </h1>
      <p v-if="description" class="font-prose max-w-2xl text-sm text-muted">
        {{ description }}
      </p>
    </div>
  </header>
</template>
