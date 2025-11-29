<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    loading: boolean
    icon: string
    size?: string
    spinnerClass?: string
  }>(),
  {
    size: 'h-4 w-4',
    spinnerClass: 'animate-spin text-primary',
  },
)
</script>

<template>
  <span class="inline-flex items-center justify-center" :class="props.size">
    <Icon
      v-if="!props.loading"
      :name="props.icon"
      :class="props.size"
      aria-hidden="true"
    />
    <Icon
      v-else
      name="line-md:loading-loop"
      :class="[props.size, props.spinnerClass]"
      aria-hidden="true"
    />
  </span>
</template>
