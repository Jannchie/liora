<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useAttrs, watch } from 'vue'

type Primitive = string | number | boolean | null | undefined

type OptionObject = object
type Item = Primitive | OptionObject

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  modelValue?: Primitive
  items?: Item[]
  valueAttribute?: string
  optionAttribute?: string
  placeholder?: string
  disabled?: boolean
  variant?: 'soft' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  invalid?: boolean
}>(), {
  variant: 'soft',
  size: 'md',
  valueAttribute: 'value',
  optionAttribute: 'label',
  items: () => [],
})

const emit = defineEmits<{
  'update:modelValue': [value: Primitive]
}>()

const attrs = useAttrs()

interface NormalizedOption {
  value: Primitive
  label: string
}

function readField(item: Item, field: string): unknown {
  if (item && typeof item === 'object') {
    return (item as Record<string, unknown>)[field]
  }
  return undefined
}

const normalized = computed<NormalizedOption[]>(() => {
  return (props.items ?? []).map((item) => {
    if (item && typeof item === 'object') {
      const rawValue = readField(item, props.valueAttribute)
      const rawLabel = readField(item, props.optionAttribute) ?? rawValue
      return {
        value: rawValue as Primitive,
        label: String(rawLabel ?? ''),
      }
    }
    return { value: item as Primitive, label: String(item ?? '') }
  })
})

const selectedOption = computed<NormalizedOption | undefined>(() =>
  normalized.value.find(option => option.value === props.modelValue),
)

const displayLabel = computed(() => selectedOption.value?.label ?? '')

const sizeClass = computed(() => {
  switch (props.size) {
    case 'sm': {
      return 'h-8 text-sm px-2.5'
    }
    case 'lg': {
      return 'h-11 text-base px-3.5'
    }
    default: {
      return 'h-9 text-sm px-3'
    }
  }
})

const variantClass = computed(() => {
  if (props.variant === 'outline') {
    return 'bg-default border border-border hover:border-border-strong'
  }
  return 'bg-muted border border-transparent hover:bg-elevated'
})

const isOpen = ref(false)
const activeIndex = ref(-1)
const triggerRef = ref<HTMLButtonElement | null>(null)
const popoverRef = ref<HTMLElement | null>(null)
const popoverStyle = ref<Record<string, string>>({})

function updatePosition(): void {
  if (!triggerRef.value) {
    return
  }
  const rect = triggerRef.value.getBoundingClientRect()
  const viewportHeight = window.innerHeight
  const margin = 4
  const desiredMaxHeight = 256
  const spaceBelow = viewportHeight - rect.bottom - margin - 8
  const spaceAbove = rect.top - margin - 8
  const desiredHeight = Math.min(desiredMaxHeight, Math.max(120, normalized.value.length * 36 + 8))
  const placeBelow = spaceBelow >= desiredHeight || spaceBelow >= spaceAbove

  popoverStyle.value = placeBelow
    ? {
        position: 'fixed',
        left: `${rect.left}px`,
        top: `${rect.bottom + margin}px`,
        width: `${rect.width}px`,
        maxHeight: `${Math.max(120, spaceBelow)}px`,
      }
    : {
        position: 'fixed',
        left: `${rect.left}px`,
        bottom: `${viewportHeight - rect.top + margin}px`,
        width: `${rect.width}px`,
        maxHeight: `${Math.max(120, spaceAbove)}px`,
      }
}

function scrollActiveIntoView(): void {
  if (!popoverRef.value || activeIndex.value < 0) {
    return
  }
  const items = popoverRef.value.querySelectorAll<HTMLElement>('[data-option]')
  const target = items[activeIndex.value]
  target?.scrollIntoView({ block: 'nearest' })
}

async function open(): Promise<void> {
  if (props.disabled) {
    return
  }
  isOpen.value = true
  await nextTick()
  updatePosition()
  const idx = normalized.value.findIndex(option => option.value === props.modelValue)
  activeIndex.value = Math.max(idx, 0)
  await nextTick()
  scrollActiveIntoView()
}

function close(): void {
  isOpen.value = false
  activeIndex.value = -1
}

function selectIndex(idx: number): void {
  const option = normalized.value[idx]
  if (!option) {
    return
  }
  emit('update:modelValue', option.value)
  close()
  triggerRef.value?.focus()
}

function onTriggerKeydown(event: KeyboardEvent): void {
  if (props.disabled) {
    return
  }
  if (!isOpen.value) {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      void open()
    }
    return
  }
  const length = normalized.value.length
  switch (event.key) {
    case 'ArrowDown': {
      event.preventDefault()
      activeIndex.value = length > 0 ? (activeIndex.value + 1) % length : -1
      scrollActiveIntoView()
      break
    }
    case 'ArrowUp': {
      event.preventDefault()
      activeIndex.value = length > 0 ? (activeIndex.value - 1 + length) % length : -1
      scrollActiveIntoView()
      break
    }
    case 'Home': {
      event.preventDefault()
      activeIndex.value = length > 0 ? 0 : -1
      scrollActiveIntoView()
      break
    }
    case 'End': {
      event.preventDefault()
      activeIndex.value = length > 0 ? length - 1 : -1
      scrollActiveIntoView()
      break
    }
    case 'Enter':
    case ' ': {
      event.preventDefault()
      if (activeIndex.value >= 0) {
        selectIndex(activeIndex.value)
      }
      break
    }
    case 'Escape': {
      event.preventDefault()
      close()
      break
    }
    case 'Tab': {
      close()
      break
    }
  }
}

function onDocumentPointerDown(event: PointerEvent): void {
  if (!isOpen.value) {
    return
  }
  const target = event.target as Node | null
  if (!target) {
    return
  }
  if (triggerRef.value?.contains(target)) {
    return
  }
  if (popoverRef.value?.contains(target)) {
    return
  }
  close()
}

let positionRafId: number | null = null

function schedulePositionUpdate(): void {
  if (positionRafId !== null) {
    return
  }
  positionRafId = globalThis.requestAnimationFrame(() => {
    positionRafId = null
    updatePosition()
  })
}

function cancelScheduledPositionUpdate(): void {
  if (positionRafId !== null) {
    globalThis.cancelAnimationFrame(positionRafId)
    positionRafId = null
  }
}

watch(isOpen, (next) => {
  if (!import.meta.client) {
    return
  }
  if (next) {
    document.addEventListener('pointerdown', onDocumentPointerDown, true)
    window.addEventListener('scroll', schedulePositionUpdate, true)
    window.addEventListener('resize', schedulePositionUpdate)
  }
  else {
    document.removeEventListener('pointerdown', onDocumentPointerDown, true)
    window.removeEventListener('scroll', schedulePositionUpdate, true)
    window.removeEventListener('resize', schedulePositionUpdate)
    cancelScheduledPositionUpdate()
  }
})

onBeforeUnmount(() => {
  if (!import.meta.client) {
    return
  }
  document.removeEventListener('pointerdown', onDocumentPointerDown, true)
  window.removeEventListener('scroll', schedulePositionUpdate, true)
  window.removeEventListener('resize', schedulePositionUpdate)
  cancelScheduledPositionUpdate()
})
</script>

<template>
  <div
    class="relative inline-flex items-stretch rounded-md transition-colors duration-150"
    :class="[
      variantClass,
      invalid ? 'border-error shadow-[var(--ring-focus-error)]' : '',
      disabled ? 'pointer-events-none opacity-60' : '',
      isOpen ? 'border-primary shadow-[var(--ring-focus)]' : '',
      (attrs.class as string | undefined),
    ]"
  >
    <button
      ref="triggerRef"
      type="button"
      :disabled="disabled"
      aria-haspopup="listbox"
      :aria-expanded="isOpen"
      v-bind="{ ...attrs, class: undefined }"
      class="flex w-full items-center justify-between gap-2 bg-transparent text-left outline-none"
      :class="sizeClass"
      @click="isOpen ? close() : void open()"
      @keydown="onTriggerKeydown"
    >
      <span v-if="displayLabel" class="truncate text-foreground">{{ displayLabel }}</span>
      <span v-else class="truncate text-fg-dimmed">{{ placeholder }}</span>
      <Icon
        name="tabler:chevron-down"
        class="h-4 w-4 shrink-0 text-muted"
        :class="isOpen ? 'rotate-180' : ''"
      />
    </button>
    <Teleport to="body">
      <div
        v-if="isOpen"
        ref="popoverRef"
        role="listbox"
        class="z-[9999] flex flex-col overflow-y-auto rounded-none border border-border bg-default py-1 shadow-[var(--shadow-md)]"
        :style="popoverStyle"
        @mousedown.prevent
      >
        <button
          v-for="(option, idx) in normalized"
          :key="`${String(option.value)}-${idx}`"
          type="button"
          role="option"
          data-option
          :aria-selected="option.value === modelValue"
          class="flex items-center justify-between gap-2 px-3 py-1.5 text-left text-sm outline-none"
          :class="[
            idx === activeIndex ? 'bg-muted' : '',
            option.value === modelValue ? 'text-primary' : 'text-foreground',
          ]"
          @mouseenter="activeIndex = idx"
          @click="selectIndex(idx)"
        >
          <span class="truncate">{{ option.label }}</span>
          <Icon
            v-if="option.value === modelValue"
            name="tabler:check"
            class="h-3.5 w-3.5 shrink-0"
          />
        </button>
        <p v-if="normalized.length === 0" class="px-3 py-2 text-xs text-muted">
          —
        </p>
      </div>
    </Teleport>
  </div>
</template>
