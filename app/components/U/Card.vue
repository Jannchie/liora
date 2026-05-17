<script setup lang="ts">
/*
 * Card — wireframe container. Sharp corners, single hairline border, no
 * shadow. Header/footer are separated by a 1px inner rule so the eye
 * reads them as zones of one frame, not stacked cards.
 *
 * Why no rounding: in the telemetry / blueprint language, containers form
 * a continuous grid. Rounded corners fight the alignment and turn each
 * panel into a discrete pill.
 */
defineOptions({ inheritAttrs: false })
defineProps<{
  ui?: { root?: string, header?: string, body?: string, footer?: string }
}>()
</script>

<template>
  <div
    class="surface-wire"
    :class="[ui?.root, $attrs.class]"
  >
    <header v-if="$slots.header" class="border-b border-[var(--color-border-muted)] px-4 py-3" :class="ui?.header">
      <slot name="header" />
    </header>
    <div class="px-4 py-4" :class="ui?.body">
      <slot />
    </div>
    <footer v-if="$slots.footer" class="border-t border-[var(--color-border-muted)] px-4 py-3" :class="ui?.footer">
      <slot name="footer" />
    </footer>
  </div>
</template>
