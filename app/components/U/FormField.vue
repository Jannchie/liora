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
  <div class="space-y-1.5">
    <div v-if="label || hint" class="flex items-center justify-between gap-2">
      <label
        v-if="label"
        :for="fieldId"
        class="block text-sm font-medium text-toned"
      >
        {{ label }}
        <span v-if="required" class="text-error">*</span>
      </label>
      <span v-if="hint" class="text-xs text-muted">{{ hint }}</span>
    </div>
    <slot />
    <p v-if="description && !error" class="text-xs text-muted">
      {{ description }}
    </p>
    <p v-if="error" class="text-xs text-error">
      {{ error }}
    </p>
  </div>
</template>
