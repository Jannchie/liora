<script setup lang="ts">
/*
 * A "section" is a content group headed by an uppercase mono caption,
 * with an optional actions slot on the right.
 *
 * `panel` turns the section into a `.wire-band`: a full-width strip of
 * the page closed by a hairline. Admin pages are a stack of these, so
 * every rule runs edge to edge between the sidebar and the shell's side.
 * Sections nested inside a modal or a card leave it off — the container
 * already draws the frame.
 *
 * Slots:
 *   - default: section body
 *   - actions: right-aligned controls in the heading row
 */
defineProps<{
  /** Main label — uppercase mono caption. */
  label?: string
  /** Optional icon glyph inside the label row. */
  icon?: string
  /** Render as a full-width ruled band. */
  panel?: boolean
}>()
</script>

<template>
  <section :class="panel ? 'wire-band space-y-4' : 'space-y-3'">
    <header class="flex min-h-7 flex-wrap items-center justify-between gap-3">
      <span class="label-caption flex shrink-0 items-center gap-2">
        <Icon v-if="icon" :name="icon" class="h-3.5 w-3.5" />
        <span>{{ label }}</span>
      </span>
      <div v-if="$slots.actions" class="flex shrink-0 flex-wrap items-center gap-1">
        <slot name="actions" />
      </div>
    </header>
    <div v-if="$slots.default">
      <slot />
    </div>
  </section>
</template>
