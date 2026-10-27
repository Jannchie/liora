<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { useFormFieldContext } from '~/composables/useFormFieldContext'

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
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
  }>(),
  {
    type: 'text',
    size: 'md',
    variant: 'soft',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
}>()

const attrs = useAttrs()
const field = useFormFieldContext(props)

const sizeClass = computed(() => {
  switch (props.size) {
    case 'sm': {
      return 'h-7 text-[13px]'
    }
    case 'lg': {
      return 'h-10 text-sm'
    }
    default: {
      return 'h-8 text-[13px]'
    }
  }
})

const padClass = computed(() => {
  const pl = props.icon ? 'pl-8' : 'pl-3'
  const pr = props.trailingIcon ? 'pr-8' : 'pr-3'
  return `${pl} ${pr}`
})

function onInput(event: Event): void {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.value)
}
</script>

<template>
  <div
    class="field-shell group/field inline-flex items-center"
    :class="attrs.class"
    :data-variant="variant"
    :data-invalid="field.invalid.value || undefined"
    :data-disabled="disabled || undefined"
    :data-readonly="readonly || undefined"
  >
    <Icon
      v-if="icon"
      :name="icon"
      class="pointer-events-none absolute left-2.5 h-4 w-4 text-dimmed transition-colors group-focus-within/field:text-highlighted"
    />
    <input
      :id="field.id.value"
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
      :aria-invalid="field.invalid.value || undefined"
      v-bind="{ ...attrs, class: undefined }"
      class="w-full min-w-0 bg-transparent outline-none disabled:cursor-not-allowed"
      :class="[sizeClass, padClass]"
      @input="onInput"
    />
    <Icon v-if="trailingIcon" :name="trailingIcon" class="pointer-events-none absolute right-2.5 h-4 w-4 text-dimmed" />
  </div>
</template>
