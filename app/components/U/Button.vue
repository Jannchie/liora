<script setup lang="ts">
import { computed } from 'vue'

type Variant = 'solid' | 'soft' | 'ghost' | 'outline' | 'subtle' | 'link'
type Color = 'primary' | 'neutral' | 'error' | 'warning' | 'success' | 'info'
type Size = 'xs' | 'sm' | 'md' | 'lg'

const props = withDefaults(defineProps<{
  variant?: Variant
  color?: Color
  size?: Size
  icon?: string
  trailingIcon?: string
  loading?: boolean
  disabled?: boolean
  block?: boolean
  square?: boolean
  type?: 'button' | 'submit' | 'reset'
  to?: string
  /** External URL — renders an anchor. Pair with target/rel attrs as needed. */
  href?: string
  ariaLabel?: string
  ariaPressed?: boolean
}>(), {
  variant: 'solid',
  color: 'primary',
  size: 'md',
  type: 'button',
})

const isDisabled = computed(() => props.disabled || props.loading)

const sizeClass = computed(() => {
  if (props.square) {
    switch (props.size) {
      case 'xs': { return 'h-7 w-7 text-xs'
      }
      case 'sm': { return 'h-8 w-8 text-sm'
      }
      case 'lg': { return 'h-11 w-11 text-base'
      }
      default: { return 'h-9 w-9 text-sm'
      }
    }
  }
  switch (props.size) {
    case 'xs': { return 'h-7 px-2 text-xs gap-1'
    }
    case 'sm': { return 'h-8 px-2.5 text-sm gap-1.5'
    }
    case 'lg': { return 'h-11 px-5 text-base gap-2'
    }
    default: { return 'h-9 px-3.5 text-sm gap-1.5'
    }
  }
})

const iconSize = computed(() => {
  switch (props.size) {
    case 'xs': { return 'h-3.5 w-3.5'
    }
    case 'sm': { return 'h-4 w-4'
    }
    case 'lg': { return 'h-5 w-5'
    }
    default: { return 'h-4 w-4'
    }
  }
})

const variantClass = computed(() => {
  const { variant, color } = props
  if (variant === 'solid') {
    if (color === 'primary') {
      return 'bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-active'
    }
    if (color === 'error') {
      return 'bg-error text-white hover:opacity-90 active:opacity-100'
    }
    if (color === 'warning') {
      return 'bg-warning text-fg-highlighted hover:opacity-90'
    }
    if (color === 'success') {
      return 'bg-success text-white hover:opacity-90'
    }
    if (color === 'info') {
      return 'bg-info text-white hover:opacity-90'
    }
    return 'bg-fg text-bg hover:opacity-90'
  }
  if (variant === 'soft') {
    if (color === 'primary') {
      return 'bg-primary-soft text-primary hover:bg-primary-softer'
    }
    if (color === 'error') {
      return 'bg-error-soft text-error hover:opacity-80'
    }
    if (color === 'warning') {
      return 'bg-warning-soft text-warning hover:opacity-80'
    }
    if (color === 'success') {
      return 'bg-success-soft text-success hover:opacity-80'
    }
    if (color === 'info') {
      return 'bg-info-soft text-info hover:opacity-80'
    }
    return 'bg-elevated text-fg hover:bg-accented'
  }
  if (variant === 'ghost') {
    if (color === 'primary') {
      return 'bg-transparent text-primary hover:bg-primary-soft'
    }
    if (color === 'error') {
      return 'bg-transparent text-error hover:bg-error-soft'
    }
    if (color === 'warning') {
      return 'bg-transparent text-warning hover:bg-warning-soft'
    }
    if (color === 'success') {
      return 'bg-transparent text-success hover:bg-success-soft'
    }
    return 'bg-transparent text-fg hover:bg-muted'
  }
  if (variant === 'outline') {
    if (color === 'primary') {
      return 'border border-primary text-primary bg-transparent hover:bg-primary-soft'
    }
    if (color === 'error') {
      return 'border border-error text-error bg-transparent hover:bg-error-soft'
    }
    return 'border border-border-strong text-fg bg-transparent hover:bg-muted'
  }
  if (variant === 'subtle') {
    return 'bg-primary-softer text-primary border border-primary-border hover:bg-primary-soft'
  }
  // link
  return 'bg-transparent text-primary hover:underline px-0 h-auto'
})

const baseClass = computed(() => [
  'inline-flex select-none items-center justify-center rounded-md font-medium leading-none',
  'transition-colors duration-150 ease-out outline-none',
  'focus-visible:shadow-[var(--ring-focus)] disabled:cursor-not-allowed disabled:opacity-55',
  sizeClass.value,
  variantClass.value,
  props.block ? 'w-full' : '',
  props.loading ? 'cursor-progress' : '',
])
</script>

<template>
  <NuxtLink
    v-if="to || href"
    :to="to ?? href"
    :external="href ? true : undefined"
    :aria-disabled="isDisabled ? 'true' : undefined"
    :aria-label="ariaLabel"
    :aria-pressed="ariaPressed"
    :class="baseClass"
  >
    <Icon v-if="loading" name="tabler:loader-2" class="animate-spin" :class="iconSize" />
    <Icon v-else-if="icon" :name="icon" :class="iconSize" />
    <span v-if="$slots.default" class="min-w-0"><slot /></span>
    <Icon v-if="trailingIcon && !loading" :name="trailingIcon" :class="iconSize" />
  </NuxtLink>
  <button
    v-else
    :type="type"
    :disabled="isDisabled"
    :aria-label="ariaLabel"
    :aria-pressed="ariaPressed"
    :class="baseClass"
  >
    <Icon v-if="loading" name="tabler:loader-2" class="animate-spin" :class="iconSize" />
    <Icon v-else-if="icon" :name="icon" :class="iconSize" />
    <span v-if="$slots.default" class="min-w-0"><slot /></span>
    <Icon v-if="trailingIcon && !loading" :name="trailingIcon" :class="iconSize" />
  </button>
</template>
