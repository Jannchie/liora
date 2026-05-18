<script setup lang="ts" generic="V extends string | number">
import { computed } from 'vue'

interface TabItem {
  label: string
  value: V
  icon?: string
  [key: string]: unknown
}

const props = withDefaults(defineProps<{
  items: TabItem[]
  modelValue?: V
  content?: boolean
  variant?: 'underline' | 'pill'
}>(), {
  content: true,
  variant: 'underline',
})

const emit = defineEmits<{
  'update:modelValue': [value: V]
}>()

const active = computed(() => props.modelValue)

function setActive(value: V): void {
  emit('update:modelValue', value)
}

const tabBaseClass = 'inline-flex shrink-0 items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:shadow-[var(--ring-focus)]'
</script>

<template>
  <div>
    <div
      class="flex items-center gap-1 overflow-x-auto overflow-y-hidden"
      :class="variant === 'underline' ? 'border-b border-[var(--color-border-muted)]' : ''"
      role="tablist"
    >
      <button
        v-for="item in items"
        :key="String(item.value)"
        type="button"
        role="tab"
        :aria-selected="active === item.value"
        :class="[
          tabBaseClass,
          variant === 'underline'
            ? (active === item.value
              ? 'text-primary shadow-[inset_0_-2px_0_0_var(--color-primary)]'
              : 'text-muted hover:text-foreground')
            : [
              'rounded-md',
              active === item.value
                ? 'bg-primary-soft text-primary'
                : 'text-muted hover:bg-muted',
            ],
        ]"
        @click="setActive(item.value)"
      >
        <slot name="leading" :item="item" :active="active === item.value">
          <Icon v-if="item.icon" :name="item.icon" class="h-4 w-4" />
        </slot>
        <span>{{ item.label }}</span>
      </button>
    </div>
    <div v-if="content" class="mt-3">
      <slot name="content">
        <template v-for="item in items" :key="String(item.value)">
          <div v-if="active === item.value" role="tabpanel">
            <slot :item="item" />
          </div>
        </template>
      </slot>
    </div>
  </div>
</template>
