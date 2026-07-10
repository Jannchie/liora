<script setup lang="ts">
/*
 * Page-level header — gallery style.
 *
 * Layout: `eyebrow / subtitle          <actions>`
 * Below: large title (the site's title voice) + optional description.
 */
defineProps<{
  /** Top-left chrome label. Rendered as a quiet caption. */
  eyebrow?: string
  /** Optional subtitle joined with `/`. */
  subtitle?: string
  /** Display title (title stack). */
  title?: string
  /** Optional description below the title (prose). */
  description?: string
  /** Icon glyph for the eyebrow row. */
  icon?: string
}>()
</script>

<template>
  <header class="flex flex-col gap-4 pb-2">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex min-w-0 flex-wrap items-center gap-2">
        <p v-if="eyebrow" class="label-caption flex items-center gap-1.5 text-foreground">
          <Icon v-if="icon" :name="icon" class="h-3.5 w-3.5 text-muted" />
          <span>{{ eyebrow }}</span>
        </p>
        <span v-if="subtitle" class="label-caption flex items-center gap-2 text-dimmed">
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
      <h1 v-if="title" class="font-title text-3xl font-semibold leading-[1.15] text-highlighted">
        {{ title }}
      </h1>
      <p v-if="description" class="font-prose max-w-2xl text-sm text-muted">
        {{ description }}
      </p>
    </div>
  </header>
</template>
