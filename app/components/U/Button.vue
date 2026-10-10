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

/*
 * Wireframe buttons, after the icons site's toolbar: small (28–32px),
 * 6px corners, regular weight. Transparent variants brighten their label
 * and pick up the sunken fill on hover; `aria-pressed` swaps in the
 * pressed state (sunken fill + inset strong hairline). Only `solid` is
 * filled, and its fill is the ink.
 */
const isDisabled = computed(() => props.disabled || props.loading)

const sizeClass = computed(() => {
  if (props.square) {
    switch (props.size) {
      case 'xs': { return 'h-6 w-6 text-xs'
      }
      case 'sm': { return 'h-7 w-7 text-[13px]'
      }
      case 'lg': { return 'h-10 w-10 text-sm'
      }
      default: { return 'h-8 w-8 text-[13px]'
      }
    }
  }
  switch (props.size) {
    case 'xs': { return 'h-6 px-2 text-xs gap-1'
    }
    case 'sm': { return 'h-7 px-2.5 text-[13px] gap-1.5'
    }
    case 'lg': { return 'h-10 px-4 text-sm gap-2'
    }
    default: { return 'h-8 px-3 text-[13px] gap-1.5'
    }
  }
})

const iconSize = computed(() => {
  switch (props.size) {
    case 'xs': { return 'h-3.5 w-3.5'
    }
    case 'lg': { return 'h-[18px] w-[18px]'
    }
    default: { return 'h-4 w-4'
    }
  }
})

/*
 * Per-variant colour tables. Neutral is the default voice of the chrome;
 * `primary` is the ink, so on transparent variants it reads as "full
 * strength" rather than as a hue. Status colours only tint the label.
 */
const TONE: Record<Color, string> = {
  primary: 'text-highlighted',
  error: 'text-error',
  warning: 'text-warning',
  success: 'text-success',
  info: 'text-info',
  neutral: 'text-muted hover:text-fg-highlighted',
}

const SOFT: Record<Color, string> = {
  primary: 'bg-muted text-highlighted hover:bg-elevated',
  error: 'bg-error-soft text-error hover:bg-error-soft-hover',
  warning: 'bg-warning-soft text-warning hover:bg-warning-soft-hover',
  success: 'bg-success-soft text-success hover:bg-success-soft-hover',
  info: 'bg-info-soft text-info hover:bg-info-soft-hover',
  neutral: 'bg-muted text-fg hover:bg-elevated',
}

const SOLID: Record<Color, string> = {
  primary: 'bg-primary text-on-primary font-medium hover:bg-primary-hover active:bg-primary-active',
  error: 'bg-error text-white font-medium hover:opacity-90',
  warning: 'bg-warning text-white font-medium hover:opacity-90',
  success: 'bg-success text-white font-medium hover:opacity-90',
  info: 'bg-info text-white font-medium hover:opacity-90',
  neutral: 'bg-primary text-on-primary font-medium hover:bg-primary-hover active:bg-primary-active',
}

const OUTLINE_BORDER: Record<Color, string> = {
  primary: 'border-border-strong',
  error: 'border-error/40',
  warning: 'border-warning/40',
  success: 'border-success/40',
  info: 'border-info/40',
  neutral: 'border-border-strong',
}

const PRESSED = 'bg-muted text-highlighted shadow-[inset_0_0_0_1px_var(--color-border-strong)]'

const variantClass = computed(() => {
  const { variant, color } = props
  if (props.ariaPressed && variant !== 'solid') {
    return PRESSED
  }
  if (variant === 'solid') {
    return SOLID[color]
  }
  if (variant === 'soft') {
    return SOFT[color]
  }
  if (variant === 'ghost') {
    return `bg-transparent ${TONE[color]} hover:bg-muted active:bg-elevated`
  }
  if (variant === 'outline') {
    return `border ${OUTLINE_BORDER[color]} ${TONE[color]} bg-transparent hover:bg-muted active:bg-elevated`
  }
  if (variant === 'subtle') {
    return 'bg-muted text-highlighted shadow-[inset_0_0_0_1px_var(--color-border-strong)] hover:bg-elevated'
  }
  // link
  return 'bg-transparent text-highlighted underline-offset-4 hover:underline px-0 h-auto'
})

const baseClass = computed(() => [
  'inline-flex select-none items-center justify-center whitespace-nowrap rounded-md leading-none',
  'transition-colors duration-150 ease-out outline-none',
  'focus-visible:shadow-[var(--ring-focus)] disabled:cursor-not-allowed disabled:opacity-45',
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
    <Icon v-if="loading" name="jannchie:loader" class="animate-spin" :class="iconSize" />
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
    <Icon v-if="loading" name="jannchie:loader" class="animate-spin" :class="iconSize" />
    <Icon v-else-if="icon" :name="icon" :class="iconSize" />
    <span v-if="$slots.default" class="min-w-0"><slot /></span>
    <Icon v-if="trailingIcon && !loading" :name="trailingIcon" :class="iconSize" />
  </button>
</template>
