<script setup lang="ts">
defineOptions({ inheritAttrs: false })
</script>

<template>
  <div
    class="animate-pulse rounded-md bg-[var(--color-elevated)]"
    :class="$attrs.class"
    aria-busy="true"
  />
</template>
