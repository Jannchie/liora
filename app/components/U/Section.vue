<script setup lang="ts">
/*
 * A "section" is a content group with a hairline top divider, a quiet
 * sentence-case label, optional inline subtitle (· separated), a meta
 * slot on the right, and an actions slot.
 *
 * Why this exists (vs a `<UCard>`):
 *   Stacked filled cards visually fragment the page. Replacing them with
 *   a single 1px top rule + a small caption heading keeps the reading
 *   rhythm intact while telling the eye "new block here."
 *
 * Slots:
 *   - default: section body
 *   - actions: right-aligned controls in the heading row
 *   - meta:    right-aligned plain metadata (e.g. timestamp range)
 *   - heading: full custom heading (replaces the label row)
 */
withDefaults(defineProps<{
  /** Main label — small caption heading. */
  label?: string
  /** Optional subtitle joined with `·`. */
  subtitle?: string
  /** Optional supplementary subtitle (joined with another `·`). */
  description?: string
  /** Page-level title rendered below the label row. Use sparingly. */
  title?: string
  /** Optional icon glyph inside the label row. */
  icon?: string
  /** Visual weight of the divider. */
  divider?: 'rule' | 'none'
}>(), {
  divider: 'rule',
})
</script>

<template>
  <section
    class="space-y-3"
    :class="[divider === 'none' ? '' : 'rule-bleed pt-5']"
  >
    <header class="flex flex-wrap items-end justify-between gap-3">
      <slot name="heading">
        <div class="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
          <span class="flex shrink-0 items-center gap-1.5 text-sm font-medium text-highlighted">
            <Icon v-if="icon" :name="icon" class="h-3.5 w-3.5 text-muted" />
            <span>{{ label }}</span>
          </span>
          <span v-if="subtitle" class="label-caption flex shrink-0 items-center gap-2 text-dimmed">
            <span aria-hidden="true">·</span>
            <span>{{ subtitle }}</span>
          </span>
          <span v-if="description" class="label-caption flex shrink-0 items-center gap-2 text-dimmed">
            <span aria-hidden="true">·</span>
            <span>{{ description }}</span>
          </span>
        </div>
      </slot>
      <div v-if="$slots.meta" class="label-caption shrink-0 text-dimmed">
        <slot name="meta" />
      </div>
      <div v-if="$slots.actions" class="flex shrink-0 flex-wrap items-center gap-2">
        <slot name="actions" />
      </div>
    </header>
    <h2 v-if="title" class="font-title text-xl font-semibold leading-tight text-highlighted">
      {{ title }}
    </h2>
    <div v-if="$slots.default">
      <slot />
    </div>
  </section>
</template>
