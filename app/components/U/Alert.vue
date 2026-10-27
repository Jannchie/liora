<script setup lang="ts">
import { computed } from 'vue'

type Color = 'primary' | 'error' | 'warning' | 'success' | 'info' | 'neutral'

const props = withDefaults(
  defineProps<{
    color?: Color
    variant?: 'solid' | 'soft' | 'subtle' | 'outline'
    title?: string
    description?: string
    icon?: string
    closable?: boolean
  }>(),
  {
    color: 'primary',
    variant: 'soft',
  },
)

const emit = defineEmits<{
  close: []
}>()

const defaultIcon: Record<Color, string> = {
  primary: 'jannchie:info',
  error: 'jannchie:octagon-x',
  warning: 'jannchie:alert-triangle',
  success: 'jannchie:check-circle',
  info: 'jannchie:info',
  neutral: 'jannchie:bell',
}

const iconName = computed(() => props.icon ?? defaultIcon[props.color])

/*
 * Wireframe alert: a hairline frame tinted toward the status colour and
 * a thin wash behind it. The colour sits on the glyph and the title
 * only; body copy stays in the neutral ramp so it remains readable.
 */
const SOLID: Record<Color, string> = {
  primary: 'bg-primary text-on-primary',
  neutral: 'bg-primary text-on-primary',
  error: 'bg-error text-white',
  warning: 'bg-warning text-white',
  success: 'bg-success text-white',
  info: 'bg-info text-white',
}

const FRAME: Record<Color, string> = {
  primary: 'border-border-strong bg-muted',
  neutral: 'border-border-strong bg-muted',
  error: 'border-error/35 bg-error/[0.06]',
  warning: 'border-warning/35 bg-warning/[0.06]',
  success: 'border-success/35 bg-success/[0.06]',
  info: 'border-info/35 bg-info/[0.06]',
}

const TINT: Record<Color, string> = {
  primary: 'text-highlighted',
  neutral: 'text-highlighted',
  error: 'text-error',
  warning: 'text-warning',
  success: 'text-success',
  info: 'text-info',
}

const variantClass = computed(() =>
  props.variant === 'solid' ? SOLID[props.color] : `border text-foreground ${FRAME[props.color]}`,
)
const tintClass = computed(() => (props.variant === 'solid' ? '' : TINT[props.color]))
</script>

<template>
  <div class="flex w-full items-start gap-3 rounded-lg px-3.5 py-3" :class="variantClass" role="alert">
    <slot name="icon">
      <Icon :name="iconName" class="mt-px h-[18px] w-[18px] shrink-0" :class="tintClass" />
    </slot>
    <div class="min-w-0 flex-1 space-y-1">
      <p v-if="title" class="text-[13px] font-medium" :class="tintClass">
        {{ title }}
      </p>
      <p v-if="description" class="text-[13px] opacity-80">
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
      <Icon name="jannchie:x" class="h-4 w-4" />
    </button>
  </div>
</template>
