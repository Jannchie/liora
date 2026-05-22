<script setup lang="ts">
import { computed } from 'vue'

type Color = 'primary' | 'error' | 'warning' | 'success' | 'info' | 'neutral'

const props = withDefaults(defineProps<{
  color?: Color
  variant?: 'solid' | 'soft' | 'subtle' | 'outline'
  title?: string
  description?: string
  icon?: string
  closable?: boolean
}>(), {
  color: 'primary',
  variant: 'soft',
})

const emit = defineEmits<{
  close: []
}>()

const defaultIcon: Record<Color, string> = {
  primary: 'tabler:info-circle',
  error: 'tabler:alert-octagon',
  warning: 'tabler:alert-triangle',
  success: 'tabler:circle-check',
  info: 'tabler:info-circle',
  neutral: 'tabler:bell',
}

const iconName = computed(() => props.icon ?? defaultIcon[props.color])

const variantClass = computed(() => {
  const { variant, color } = props
  if (variant === 'solid') {
    if (color === 'error') {
      return 'bg-error text-white'
    }
    if (color === 'warning') {
      return 'bg-warning text-fg-highlighted'
    }
    if (color === 'success') {
      return 'bg-success text-white'
    }
    if (color === 'info') {
      return 'bg-info text-white'
    }
    return 'bg-primary text-on-primary'
  }
  if (variant === 'outline') {
    if (color === 'error') {
      return 'border border-error text-error'
    }
    if (color === 'warning') {
      return 'border border-warning text-warning'
    }
    if (color === 'success') {
      return 'border border-success text-success'
    }
    return 'border border-primary text-primary'
  }
  // soft / subtle
  if (color === 'error') {
    return 'bg-error-soft text-error'
  }
  if (color === 'warning') {
    return 'bg-warning-soft text-warning'
  }
  if (color === 'success') {
    return 'bg-success-soft text-success'
  }
  if (color === 'info') {
    return 'bg-info-soft text-info'
  }
  return 'bg-primary-soft text-primary'
})
</script>

<template>
  <div
    class="flex w-full items-start gap-3 px-4 py-3"
    :class="variantClass"
    role="alert"
  >
    <slot name="icon">
      <Icon :name="iconName" class="mt-0.5 h-5 w-5 shrink-0" />
    </slot>
    <div class="min-w-0 flex-1 space-y-1">
      <p v-if="title" class="text-sm font-semibold">
        {{ title }}
      </p>
      <p v-if="description" class="text-xs opacity-90">
        {{ description }}
      </p>
      <slot />
      <div v-if="$slots.actions" class="mt-2 flex flex-wrap gap-2">
        <slot name="actions" />
      </div>
    </div>
    <button
      v-if="closable"
      type="button"
      class="shrink-0 rounded p-0.5 opacity-70 transition hover:opacity-100"
      aria-label="Dismiss"
      @click="emit('close')"
    >
      <Icon name="tabler:x" class="h-4 w-4" />
    </button>
  </div>
</template>
