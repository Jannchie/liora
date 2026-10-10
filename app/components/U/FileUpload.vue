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
    class="group relative flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-14 text-center outline-none transition-colors duration-150 focus-visible:shadow-[var(--ring-focus)] sm:py-16"
    :class="[
      isDragging
        ? 'border-primary bg-muted'
        : 'border-border-strong hover:border-fg-subtle hover:bg-muted',
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
    <span
      class="flex h-11 w-11 items-center justify-center rounded-md border border-border-strong text-highlighted transition-colors"
      :class="isDragging ? 'bg-default' : ''"
    >
      <Icon name="jannchie:cloud-upload" class="h-6 w-6" />
    </span>
    <div class="space-y-1">
      <p v-if="label" class="text-[13px] font-medium text-highlighted">
        {{ label }}
      </p>
      <p v-if="description" class="text-xs text-dimmed">
        {{ description }}
      </p>
      <p v-if="modelValue" class="font-mono text-xs text-highlighted">
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
