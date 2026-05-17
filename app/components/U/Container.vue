<script setup lang="ts">
defineOptions({ inheritAttrs: false })
</script>

<template>
  <div class="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8" :class="$attrs.class">
    <slot />
  </div>
</template>
