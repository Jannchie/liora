<script setup lang="ts">
import { computed, provide } from 'vue'

const props = defineProps<{
  label?: string
  description?: string
  hint?: string
  error?: string
  name?: string
  required?: boolean
  size?: 'sm' | 'md' | 'lg'
}>()

const fieldId = computed(() => (props.name ? `field-${props.name}` : undefined))

provide('u-form-field', {
  id: fieldId,
  name: () => props.name,
  invalid: () => Boolean(props.error),
})
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <div v-if="label || hint" class="flex items-baseline justify-between gap-2">
      <label
        v-if="label"
        :for="fieldId"
        class="text-xs font-medium text-muted"
      >
        {{ label }}
        <span v-if="required" class="text-error" aria-hidden="true">*</span>
      </label>
      <span v-if="hint" class="text-[11px] text-dimmed">{{ hint }}</span>
    </div>
    <slot />
    <p v-if="error" class="flex items-start gap-1 text-xs leading-snug text-error" role="alert">
      <Icon name="jannchie:alert-circle" class="mt-px h-3.5 w-3.5 shrink-0" />
      <span>{{ error }}</span>
    </p>
    <p v-else-if="description" class="text-xs leading-snug text-dimmed">
      {{ description }}
    </p>
  </div>
</template>
