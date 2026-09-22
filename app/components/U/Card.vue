<script setup lang="ts">
/*
 * Card — quiet container: a raised fill, soft rounding, a whisper of
 * shadow, no outline. Header and footer are set off by padding alone;
 * they share the card's fill, so an inner rule would only cut one
 * surface into three.
 */
defineOptions({ inheritAttrs: false })
defineProps<{
  ui?: { root?: string, header?: string, body?: string, footer?: string }
}>()
</script>

<template>
  <div
    class="surface-card"
    :class="[ui?.root, $attrs.class]"
  >
    <header v-if="$slots.header" class="px-5 pb-3 pt-4" :class="ui?.header">
      <slot name="header" />
    </header>
    <div class="px-5 py-4" :class="ui?.body">
      <slot />
    </div>
    <footer v-if="$slots.footer" class="px-5 pb-4 pt-2" :class="ui?.footer">
      <slot name="footer" />
    </footer>
  </div>
</template>
