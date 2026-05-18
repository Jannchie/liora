<script setup lang="ts" generic="T extends object">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  modelValue?: unknown
  items?: T[]
  multiple?: boolean
  labelKey?: string
  valueKey?: string
  filterFields?: string[]
  placeholder?: string
  icon?: string
  loading?: boolean
  disabled?: boolean
  portal?: boolean
}>(), {
  multiple: false,
  labelKey: 'label',
  valueKey: 'value',
  items: () => [],
  filterFields: () => ['label'],
  icon: 'tabler:chevron-down',
})

const emit = defineEmits<{
  'update:modelValue': [value: unknown]
}>()

const open = ref(false)
const query = ref('')
const rootEl = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLInputElement | null>(null)

function readField<R = unknown>(item: T, field: string): R | undefined {
  return ((item as Record<string, unknown>)?.[field] as R | undefined)
}

const selectedValues = computed<unknown[]>(() => {
  const raw = props.modelValue
  if (props.multiple) {
    return Array.isArray(raw) ? raw : []
  }
  return raw === undefined || raw === null ? [] : [raw]
})

const selectedItems = computed<T[]>(() => {
  return selectedValues.value
    .map(val => props.items.find(item => readField(item, props.valueKey) === val))
    .filter((item): item is T => item !== undefined)
})

const filteredItems = computed<T[]>(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) {
    return props.items
  }
  return props.items.filter((item) => {
    return props.filterFields.some((field) => {
      const value = readField(item, field)
      return typeof value === 'string' && value.toLowerCase().includes(q)
    })
  })
})

function toggleItem(item: T): void {
  const value = readField(item, props.valueKey)
  if (props.multiple) {
    const current = Array.isArray(props.modelValue) ? [...props.modelValue] : []
    const idx = current.indexOf(value)
    if (idx === -1) {
      current.push(value)
    }
    else {
      current.splice(idx, 1)
    }
    emit('update:modelValue', current)
  }
  else {
    emit('update:modelValue', value)
    open.value = false
  }
}

function isSelected(item: T): boolean {
  return selectedValues.value.includes(readField(item, props.valueKey))
}

function removeItem(item: T): void {
  if (!props.multiple) {
    emit('update:modelValue', undefined)
    return
  }
  const value = readField(item, props.valueKey)
  const next = (Array.isArray(props.modelValue) ? props.modelValue : []).filter(v => v !== value)
  emit('update:modelValue', next)
}

function openMenu(): void {
  if (props.disabled) {
    return
  }
  open.value = true
  void nextTick(() => inputEl.value?.focus())
}

function onClickOutside(event: MouseEvent): void {
  if (!rootEl.value) {
    return
  }
  if (!rootEl.value.contains(event.target as Node)) {
    open.value = false
  }
}

watch(open, (isOpen) => {
  if (!import.meta.client) {
    return
  }
  if (isOpen) {
    document.addEventListener('mousedown', onClickOutside)
  }
  else {
    document.removeEventListener('mousedown', onClickOutside)
    query.value = ''
  }
})

onBeforeUnmount(() => {
  if (!import.meta.client) {
    return
  }
  document.removeEventListener('mousedown', onClickOutside)
})
</script>

<template>
  <div ref="rootEl" class="relative w-full">
    <button
      type="button"
      :disabled="disabled"
      class="flex w-full min-h-9 cursor-text items-center gap-2 rounded-md border border-transparent bg-[var(--color-muted)] px-3 py-1.5 text-left text-sm transition-colors hover:bg-[var(--color-elevated)] focus-within:border-[var(--color-primary)] focus-within:bg-[var(--color-default)] focus-within:shadow-[var(--ring-focus)]"
      :class="open ? 'border-[var(--color-primary)] bg-[var(--color-default)] shadow-[var(--ring-focus)]' : ''"
      @click="openMenu"
    >
      <Icon v-if="icon" :name="icon" class="h-4 w-4 shrink-0 text-muted" />
      <div class="flex min-w-0 flex-1 flex-wrap items-center gap-1">
        <template v-if="multiple">
          <span
            v-for="item in selectedItems"
            :key="String(readField(item, valueKey))"
            class="inline-flex items-center gap-1 rounded-md bg-primary-soft px-1.5 py-0.5 text-xs text-primary"
          >
            {{ readField(item, labelKey) }}
            <button
              type="button"
              class="text-primary/70 hover:text-primary"
              @click.stop="removeItem(item)"
            >
              <Icon name="tabler:x" class="h-3 w-3" />
            </button>
          </span>
        </template>
        <template v-else-if="selectedItems.length > 0">
          <span class="truncate text-foreground">{{ readField(selectedItems[0]!, labelKey) }}</span>
        </template>
        <span v-if="selectedItems.length === 0 && !open" class="text-[var(--color-fg-dimmed)]">{{ placeholder }}</span>
      </div>
      <Icon
        v-if="loading"
        name="tabler:loader-2"
        class="h-4 w-4 shrink-0 animate-spin text-muted"
      />
      <Icon
        v-else
        name="tabler:chevron-down"
        class="h-4 w-4 shrink-0 text-muted transition-transform"
        :class="open ? 'rotate-180' : ''"
      />
    </button>

    <Transition
      enter-active-class="transition duration-100"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-75"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg bg-default shadow-[var(--shadow-md)] ring-1 ring-[var(--color-border)]"
      >
        <div class="border-b border-[var(--color-border-muted)] p-2">
          <input
            ref="inputEl"
            v-model="query"
            type="text"
            :placeholder="placeholder"
            class="w-full rounded bg-transparent px-2 py-1 text-sm outline-none placeholder:text-[var(--color-fg-dimmed)]"
            @keydown.escape="open = false"
          >
        </div>
        <div class="max-h-60 overflow-auto py-1">
          <button
            v-for="item in filteredItems"
            :key="String(readField(item, valueKey))"
            type="button"
            class="flex w-full items-start gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-muted"
            :class="isSelected(item) ? 'bg-primary-soft text-primary' : 'text-foreground'"
            @click="toggleItem(item)"
          >
            <Icon
              v-if="multiple"
              :name="isSelected(item) ? 'tabler:square-check-filled' : 'tabler:square'"
              class="mt-0.5 h-4 w-4 shrink-0"
              :class="isSelected(item) ? 'text-primary' : 'text-muted'"
            />
            <span class="min-w-0 flex-1">
              <slot name="item-label" :item="item">
                {{ readField(item, labelKey) }}
              </slot>
            </span>
          </button>
          <p v-if="filteredItems.length === 0" class="px-3 py-2 text-xs text-muted">
            {{ loading ? '…' : '—' }}
          </p>
        </div>
      </div>
    </Transition>
  </div>
</template>
