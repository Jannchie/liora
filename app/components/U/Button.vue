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
      case 'xs': return 'h-7 w-7 text-xs'
      case 'sm': return 'h-8 w-8 text-sm'
      case 'lg': return 'h-11 w-11 text-base'
      default: return 'h-9 w-9 text-sm'
    }
  }
  switch (props.size) {
    case 'xs': return 'h-7 px-2 text-xs gap-1'
    case 'sm': return 'h-8 px-2.5 text-sm gap-1.5'
    case 'lg': return 'h-11 px-5 text-base gap-2'
    default: return 'h-9 px-3.5 text-sm gap-1.5'
  }
})

const iconSize = computed(() => {
  switch (props.size) {
    case 'xs': return 'h-3.5 w-3.5'
    case 'sm': return 'h-4 w-4'
    case 'lg': return 'h-5 w-5'
    default: return 'h-4 w-4'
  }
})

const variantClass = computed(() => {
  const { variant, color } = props
  if (variant === 'solid') {
    if (color === 'primary') return 'bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:bg-[var(--color-primary-hover)] active:bg-[var(--color-primary-active)]'
    if (color === 'error') return 'bg-[var(--color-error)] text-white hover:opacity-90 active:opacity-100'
    if (color === 'warning') return 'bg-[var(--color-warning)] text-[var(--color-fg-highlighted)] hover:opacity-90'
    if (color === 'success') return 'bg-[var(--color-success)] text-white hover:opacity-90'
    if (color === 'info') return 'bg-[var(--color-info)] text-white hover:opacity-90'
    return 'bg-[var(--color-fg)] text-[var(--color-bg)] hover:opacity-90'
  }
  if (variant === 'soft') {
    if (color === 'primary') return 'bg-[var(--color-primary-soft)] text-[var(--color-primary)] hover:bg-[var(--color-primary-softer)]'
    if (color === 'error') return 'bg-[var(--color-error-soft)] text-[var(--color-error)] hover:opacity-80'
    if (color === 'warning') return 'bg-[var(--color-warning-soft)] text-[var(--color-warning)] hover:opacity-80'
    if (color === 'success') return 'bg-[var(--color-success-soft)] text-[var(--color-success)] hover:opacity-80'
    if (color === 'info') return 'bg-[var(--color-info-soft)] text-[var(--color-info)] hover:opacity-80'
    return 'bg-[var(--color-elevated)] text-[var(--color-fg)] hover:bg-[var(--color-accented)]'
  }
  if (variant === 'ghost') {
    if (color === 'primary') return 'bg-transparent text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]'
    if (color === 'error') return 'bg-transparent text-[var(--color-error)] hover:bg-[var(--color-error-soft)]'
    if (color === 'warning') return 'bg-transparent text-[var(--color-warning)] hover:bg-[var(--color-warning-soft)]'
    if (color === 'success') return 'bg-transparent text-[var(--color-success)] hover:bg-[var(--color-success-soft)]'
    return 'bg-transparent text-[var(--color-fg)] hover:bg-[var(--color-muted)]'
  }
  if (variant === 'outline') {
    if (color === 'primary') return 'border border-[var(--color-primary)] text-[var(--color-primary)] bg-transparent hover:bg-[var(--color-primary-soft)]'
    if (color === 'error') return 'border border-[var(--color-error)] text-[var(--color-error)] bg-transparent hover:bg-[var(--color-error-soft)]'
    return 'border border-[var(--color-border-strong)] text-[var(--color-fg)] bg-transparent hover:bg-[var(--color-muted)]'
  }
  if (variant === 'subtle') {
    return 'bg-[var(--color-primary-softer)] text-[var(--color-primary)] border border-[var(--color-primary-border)] hover:bg-[var(--color-primary-soft)]'
  }
  // link
  return 'bg-transparent text-[var(--color-primary)] hover:underline px-0 h-auto'
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
    v-if="to"
    :to="to"
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
