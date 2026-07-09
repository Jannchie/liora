<script setup lang="ts">
import { ref } from 'vue'

const props = withDefaults(defineProps<{
  modelValue?: File | null
  accept?: string
  label?: string
  description?: string
  multiple?: boolean
  disabled?: boolean
}>(), {
  modelValue: null,
})

const emit = defineEmits<{
  'update:modelValue': [value: File | null]
}>()

const isDragging = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)

function pick(): void {
  if (props.disabled) {
    return
  }
  inputRef.value?.click()
}

function handleFiles(files: FileList | null): void {
  if (!files || files.length === 0) {
    emit('update:modelValue', null)
    return
  }
  emit('update:modelValue', files[0] ?? null)
}

function onChange(event: Event): void {
  const target = event.target as HTMLInputElement
  handleFiles(target.files)
}

function onDrop(event: DragEvent): void {
  event.preventDefault()
  isDragging.value = false
  if (props.disabled) {
    return
  }
  handleFiles(event.dataTransfer?.files ?? null)
}

function onDragOver(event: DragEvent): void {
  event.preventDefault()
  if (props.disabled) {
    return
  }
  isDragging.value = true
}

function onDragLeave(): void {
  isDragging.value = false
}

function clear(): void {
  emit('update:modelValue', null)
  if (inputRef.value) {
    inputRef.value.value = ''
  }
}

defineExpose({ inputRef, clear })
</script>

<template>
  <div
    class="relative flex flex-col items-center justify-center gap-2 rounded-none border-2 border-dashed px-6 py-10 text-center outline-none transition-colors focus-visible:shadow-[var(--ring-focus)]"
    :class="[
      isDragging
        ? 'border-primary bg-primary-soft'
        : 'border-border-strong bg-muted hover:border-primary/60 hover:bg-elevated',
      disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
    ]"
    role="button"
    tabindex="0"
    @click="pick"
    @keydown.enter.space.prevent="pick"
    @drop="onDrop"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
  >
    <Icon name="tabler:cloud-upload" class="h-8 w-8 text-muted" />
    <div class="space-y-1">
      <p v-if="label" class="text-sm font-medium text-highlighted">
        {{ label }}
      </p>
      <p v-if="description" class="text-xs text-muted">
        {{ description }}
      </p>
      <p v-if="modelValue" class="text-xs text-primary">
        {{ modelValue.name }}
      </p>
    </div>
    <input
      ref="inputRef"
      type="file"
      class="hidden"
      :accept="accept"
      :multiple="multiple"
      :disabled="disabled"
      @change="onChange"
    >
  </div>
</template>
