<script setup lang="ts">
import { computed, useAttrs } from 'vue'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  modelValue?: string | number | null
  type?: string
  placeholder?: string
  icon?: string
  trailingIcon?: string
  disabled?: boolean
  readonly?: boolean
  size?: 'sm' | 'md' | 'lg'
  invalid?: boolean
  variant?: 'soft' | 'outline'
  id?: string
  autocomplete?: string
  step?: string | number
  min?: string | number
  max?: string | number
  required?: boolean
}>(), {
  type: 'text',
  size: 'md',
  variant: 'soft',
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
}>()

const attrs = useAttrs()

const sizeClass = computed(() => {
  switch (props.size) {
    case 'sm': { return 'h-7 text-[13px]'
    }
    case 'lg': { return 'h-11 text-base'
    }
    default: { return 'h-8 text-[13px]'
    }
  }
})

const padClass = computed(() => {
  const pl = props.icon ? 'pl-8' : 'pl-2.5'
  const pr = props.trailingIcon ? 'pr-8' : 'pr-2.5'
  return `${pl} ${pr}`
})

const variantClass = computed(() => {
  if (props.variant === 'outline') {
    return 'bg-transparent border border-border-strong hover:border-fg-subtle focus-within:border-primary focus-within:shadow-[var(--ring-focus)]'
  }
  return 'bg-default border border-border-strong hover:border-fg-subtle focus-within:border-primary focus-within:shadow-[var(--ring-focus)]'
})

function onInput(event: Event): void {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.value)
}
</script>

<template>
  <div
    class="relative inline-flex items-center rounded-md transition-colors duration-150"
    :class="[
      variantClass,
      invalid ? 'border-error focus-within:border-error focus-within:shadow-[var(--ring-focus-error)]' : '',
      disabled ? 'opacity-60 cursor-not-allowed' : '',
      attrs.class,
    ]"
  >
    <Icon v-if="icon" :name="icon" class="absolute left-2.5 h-4 w-4 text-muted pointer-events-none" />
    <input
      :id="id"
      :type="type"
      :value="modelValue ?? ''"
      :placeholder="placeholder"
      :disabled="disabled"
      :readonly="readonly"
      :autocomplete="autocomplete"
      :step="step"
      :min="min"
      :max="max"
      :required="required"
      :aria-invalid="invalid || undefined"
      v-bind="{ ...attrs, class: undefined }"
      class="w-full bg-transparent outline-none placeholder:text-fg-subtle"
      :class="[sizeClass, padClass]"
      @input="onInput"
    >
    <Icon v-if="trailingIcon" :name="trailingIcon" class="absolute right-2.5 h-4 w-4 text-muted pointer-events-none" />
  </div>
</template>
