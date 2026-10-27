<script setup lang="ts">
/*
 * Card — a hairline frame, no shadow. Header and footer are ruled off
 * with the same hairline as the frame, so a card reads as one wireframe
 * box cut into rows rather than three stacked fills.
 */
defineOptions({ inheritAttrs: false })
defineProps<{
  ui?: { root?: string; header?: string; body?: string; footer?: string }
}>()
</script>

<template>
  <div class="surface-card" :class="[ui?.root, $attrs.class]">
    <header v-if="$slots.header" class="border-b border-border px-4 py-3" :class="ui?.header">
      <slot name="header" />
    </header>
    <div class="px-4 py-4" :class="ui?.body">
      <slot />
    </div>
    <footer v-if="$slots.footer" class="border-t border-border px-4 py-3" :class="ui?.footer">
      <slot name="footer" />
    </footer>
  </div>
</template>
