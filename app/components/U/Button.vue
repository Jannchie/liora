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
 * Hover / press feedback is a translucent neutral wash (see
 * `--overlay-hover` in main.css). A fixed fill such as `bg-muted` only
 * reads correctly on one background: on a panel — which is lighter than
 * the grey — the control appears to sink into a hole on hover. The
 * overlay is relative to whatever sits beneath, so one rule covers the
 * page ground, panels and sunken wells alike. Coloured variants keep
 * their colour in the label and the glyph rather than flooding the
 * button with a second tint.
 */
const HOVER_OVERLAY = 'hover:bg-overlay-hover active:bg-overlay-active'

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

/*
 * Per-variant colour tables.
 *
 * Once hover feedback became uniform (a neutral wash for the
 * transparent variants, a deepened tint for the filled ones), the
 * per-colour branches differed only by the colour word — thirteen `if`s
 * spelling out one rule each, which is how `ghost` ended up with no
 * `info` case and silently fell through to the neutral foreground. A
 * table states the rule once and cannot forget a colour.
 *
 * `solid` is a table too, but a less regular one: the brand colour gets
 * a dedicated hover/active pair from the palette, while the status
 * colours dim instead, because there is no second tone defined for them.
 */
const TONE: Record<Color, string> = {
  primary: 'text-primary',
  error: 'text-error',
  warning: 'text-warning',
  success: 'text-success',
  info: 'text-info',
  neutral: 'text-fg',
}

const SOFT: Record<Color, string> = {
  primary: 'bg-primary-soft text-primary hover:bg-primary-soft-hover',
  error: 'bg-error-soft text-error hover:bg-error-soft-hover',
  warning: 'bg-warning-soft text-warning hover:bg-warning-soft-hover',
  success: 'bg-success-soft text-success hover:bg-success-soft-hover',
  info: 'bg-info-soft text-info hover:bg-info-soft-hover',
  neutral: 'bg-elevated text-fg hover:bg-accented',
}

const SOLID: Record<Color, string> = {
  primary: 'bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-active',
  error: 'bg-error text-white hover:opacity-90',
  warning: 'bg-warning text-fg-highlighted hover:opacity-90',
  success: 'bg-success text-white hover:opacity-90',
  info: 'bg-info text-white hover:opacity-90',
  neutral: 'bg-fg text-bg hover:opacity-90',
}

const OUTLINE_BORDER: Record<Color, string> = {
  primary: 'border-primary',
  error: 'border-error',
  warning: 'border-warning',
  success: 'border-success',
  info: 'border-info',
  neutral: 'border-border-strong',
}

const variantClass = computed(() => {
  const { variant, color } = props
  if (variant === 'solid') {
    return SOLID[color]
  }
  if (variant === 'soft') {
    return SOFT[color]
  }
  if (variant === 'ghost') {
    return `bg-transparent ${TONE[color]} ${HOVER_OVERLAY}`
  }
  if (variant === 'outline') {
    return `border ${OUTLINE_BORDER[color]} ${TONE[color]} bg-transparent ${HOVER_OVERLAY}`
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
