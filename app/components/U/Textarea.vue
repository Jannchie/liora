<script setup lang="ts">
import { useAttrs } from 'vue'
import { useFormFieldContext } from '~/composables/useFormFieldContext'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  modelValue?: string
  placeholder?: string
  rows?: number
  disabled?: boolean
  readonly?: boolean
  variant?: 'soft' | 'outline'
  invalid?: boolean
  id?: string
}>(), {
  variant: 'soft',
  rows: 3,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const attrs = useAttrs()
const field = useFormFieldContext(props)

function onInput(event: Event): void {
  emit('update:modelValue', (event.target as HTMLTextAreaElement).value)
}
</script>

<template>
  <div
    class="field-shell"
    :class="attrs.class"
    :data-variant="variant"
    :data-invalid="field.invalid.value || undefined"
    :data-disabled="disabled || undefined"
    :data-readonly="readonly || undefined"
  >
    <textarea
      :id="field.id.value"
      :value="modelValue ?? ''"
      :placeholder="placeholder"
      :rows="rows"
      :disabled="disabled"
      :readonly="readonly"
      :aria-invalid="field.invalid.value || undefined"
      v-bind="{ ...attrs, class: undefined }"
      class="block w-full resize-y bg-transparent px-3 py-2 text-[13px] leading-relaxed outline-none disabled:cursor-not-allowed"
      @input="onInput"
    />
  </div>
</template>
