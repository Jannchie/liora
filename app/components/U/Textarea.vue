<script setup lang="ts">
import { computed, useAttrs } from 'vue'

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

const variantClass = computed(() => {
  if (props.variant === 'outline') {
    return 'bg-[var(--color-default)] border border-[var(--color-border)] hover:border-[var(--color-border-strong)] focus-within:border-[var(--color-primary)] focus-within:shadow-[var(--ring-focus)]'
  }
  return 'bg-[var(--color-muted)] border border-transparent hover:bg-[var(--color-elevated)] focus-within:bg-[var(--color-default)] focus-within:border-[var(--color-primary)] focus-within:shadow-[var(--ring-focus)]'
})

function onInput(event: Event): void {
  emit('update:modelValue', (event.target as HTMLTextAreaElement).value)
}
</script>

<template>
  <div
    class="rounded-md transition-colors duration-150"
    :class="[
      variantClass,
      invalid ? 'border-[var(--color-error)] focus-within:border-[var(--color-error)] focus-within:shadow-[var(--ring-focus-error)]' : '',
      disabled ? 'opacity-60' : '',
      attrs.class,
    ]"
  >
    <textarea
      :id="id"
      :value="modelValue ?? ''"
      :placeholder="placeholder"
      :rows="rows"
      :disabled="disabled"
      :readonly="readonly"
      :aria-invalid="invalid || undefined"
      v-bind="{ ...attrs, class: undefined }"
      class="block w-full resize-y bg-transparent px-3 py-2 text-sm outline-none placeholder:text-[var(--color-fg-dimmed)]"
      @input="onInput"
    />
  </div>
</template>
