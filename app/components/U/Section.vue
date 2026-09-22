<script setup lang="ts">
/*
 * A "section" is a content group with a quiet sentence-case label and an
 * optional actions slot on the right.
 *
 * Why this exists (vs a `<UCard>`):
 *   Stacked filled cards visually fragment the page. A small caption
 *   heading over generous top space keeps the reading rhythm intact
 *   while telling the eye "new block here" — no rule required.
 *
 * `panel` is opt-in, not a default: whether a group sits on its own
 * sheet of paper is a decision for the page. Admin pages turn it on;
 * sections nested inside a modal leave it off, because the modal is
 * already the sheet.
 *
 * Slots:
 *   - default: section body
 *   - actions: right-aligned controls in the heading row
 */
defineProps<{
  /** Main label — small caption heading. */
  label?: string
  /** Optional icon glyph inside the label row. */
  icon?: string
  /** Render the body on a raised panel. */
  panel?: boolean
}>()
</script>

<template>
  <section class="space-y-3">
    <header class="flex flex-wrap items-end justify-between gap-3">
      <span class="flex shrink-0 items-center gap-1.5 text-sm font-medium text-highlighted">
        <Icon v-if="icon" :name="icon" class="h-3.5 w-3.5 text-muted" />
        <span>{{ label }}</span>
      </span>
      <div v-if="$slots.actions" class="flex shrink-0 flex-wrap items-center gap-2">
        <slot name="actions" />
      </div>
    </header>
    <div v-if="$slots.default" :class="panel ? 'surface-card p-4 sm:p-5' : ''">
      <slot />
    </div>
  </section>
</template>
