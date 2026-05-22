<script setup lang="ts">
defineOptions({ inheritAttrs: false })
withDefaults(defineProps<{
  /**
   * Render vertical side rails (1px borders) on the container's left and
   * right edges. Used by admin / telemetry surfaces to give the page a
   * framed, blueprint feel.
   */
  rails?: boolean
}>(), {
  rails: false,
})
</script>

<template>
  <div
    class="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 [--page-px:1rem] sm:[--page-px:1.5rem] lg:[--page-px:2rem]"
    :class="[rails ? 'border-x border-border min-h-screen' : '', $attrs.class]"
  >
    <slot />
  </div>
</template>
