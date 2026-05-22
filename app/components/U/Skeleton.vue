<script setup lang="ts">
defineOptions({ inheritAttrs: false })
</script>

<template>
  <div
    class="animate-pulse rounded-md bg-elevated"
    :class="$attrs.class"
    aria-busy="true"
  />
</template>
