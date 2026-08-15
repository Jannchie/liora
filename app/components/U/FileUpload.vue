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
    class="group relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-14 text-center outline-none transition-all duration-200 focus-visible:shadow-[var(--ring-focus)] sm:py-16"
    :class="[
      isDragging
        ? 'scale-[1.01] border-primary bg-primary-soft'
        : 'border-border-strong bg-muted/60 hover:border-primary/60 hover:bg-primary-soft/40',
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
      class="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary transition-transform duration-200 group-hover:-translate-y-0.5"
      :class="isDragging ? 'scale-110' : ''"
    >
      <Icon name="tabler:cloud-upload" class="h-7 w-7" />
    </span>
    <div class="space-y-1">
      <p v-if="label" class="text-sm font-semibold text-highlighted">
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
