<script setup lang="ts">
/*
 * A "section" is a content group with a hairline top divider, an uppercase
 * tracking label, and an optional inline-flush actions slot on the right.
 *
 * Why this exists (vs a `<UCard>`):
 *   Stacked rounded-xl + fill cards visually fragment the page. Replacing
 *   them with a single 1px top rule + typographic heading keeps the
 *   reading rhythm intact while still telling the eye "new section here."
 *   This is the codetime.dev / NYT-section pattern.
 *
 * Slots:
 *   - default: section body
 *   - actions: right-aligned controls in the heading row
 *   - heading: full custom heading (replaces the label/title pair)
 */
defineProps<{
  label?: string
  title?: string
  description?: string
  icon?: string
  /**
   * Visual weight of the divider. "rule" = 1px top border (default);
   * "none" = no divider, just spacing.
   */
  divider?: 'rule' | 'none'
}>()
</script>

<template>
  <section
    class="space-y-4"
    :class="[divider === 'none' ? '' : 'border-t border-[var(--color-border-muted)] pt-6']"
  >
    <header class="flex flex-wrap items-end justify-between gap-3">
      <slot name="heading">
        <div class="space-y-1.5">
          <p v-if="label" class="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            <Icon v-if="icon" :name="icon" class="h-3.5 w-3.5" />
            <span>{{ label }}</span>
          </p>
          <h2 v-if="title" class="text-xl font-semibold leading-tight text-highlighted">
            {{ title }}
          </h2>
          <p v-if="description" class="max-w-2xl text-sm text-muted">
            {{ description }}
          </p>
        </div>
      </slot>
      <div v-if="$slots.actions" class="flex shrink-0 flex-wrap items-center gap-2">
        <slot name="actions" />
      </div>
    </header>
    <div v-if="$slots.default">
      <slot />
    </div>
  </section>
</template>
