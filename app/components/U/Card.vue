<script setup lang="ts">
defineOptions({ inheritAttrs: false })
defineProps<{
  ui?: { root?: string, header?: string, body?: string, footer?: string }
}>()
</script>

<template>
  <div
    class="rounded-lg bg-default shadow-[var(--shadow-sm)] ring-1 ring-[var(--color-border)]"
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
