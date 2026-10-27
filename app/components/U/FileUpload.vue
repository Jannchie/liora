<script setup lang="ts">
import { ref } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue?: File | null
    accept?: string
    label?: string
    description?: string
    multiple?: boolean
    disabled?: boolean
  }>(),
  {
    modelValue: null,
  },
)

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
  <!-- The whole surface is the hit area: no dashed frame, just a fill that
       answers hover and an inset primary hairline while a file is dragged
       over. Callers can fill the default slot to make their own chrome
       (captions, hints) part of the same target. -->
  <div
    class="group relative flex cursor-pointer flex-col outline-none transition-colors duration-150 focus-visible:shadow-[var(--ring-focus)]"
    :class="[
      isDragging ? 'bg-muted shadow-[inset_0_0_0_1px_var(--color-primary)]' : 'hover:bg-muted',
      disabled ? 'pointer-events-none opacity-60' : '',
    ]"
    role="button"
    tabindex="0"
    data-dropzone
    :aria-disabled="disabled || undefined"
    @click="pick"
    @keydown.enter.space.prevent="pick"
    @drop="onDrop"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
  >
    <slot />
    <div class="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center sm:py-14">
      <span
        class="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-highlighted transition-colors duration-150 group-hover:bg-accented"
        :class="isDragging ? 'bg-accented text-primary' : ''"
      >
        <Icon
          name="jannchie:cloud-upload"
          class="h-6 w-6 transition-transform duration-150 group-hover:-translate-y-0.5"
        />
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
    </div>
    <input
      ref="inputRef"
      type="file"
      class="hidden"
      :accept="accept"
      :multiple="multiple"
      :disabled="disabled"
      @change="onChange"
    />
  </div>
</template>
