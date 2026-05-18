<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  page?: number
  itemsPerPage?: number
  total?: number
  siblingCount?: number
}>(), {
  page: 1,
  itemsPerPage: 10,
  total: 0,
  siblingCount: 1,
})

const emit = defineEmits<{
  'update:page': [value: number]
}>()

const pageCount = computed(() => Math.max(1, Math.ceil((props.total ?? 0) / (props.itemsPerPage || 1))))

const visiblePages = computed<Array<number | '…'>>(() => {
  const total = pageCount.value
  const current = props.page
  const window = props.siblingCount
  if (total <= 7) {
    return Array.from({ length: total }, (_, idx) => idx + 1)
  }
  const left = Math.max(2, current - window)
  const right = Math.min(total - 1, current + window)
  const items: Array<number | '…'> = [1]
  if (left > 2) {
    items.push('…')
  }
  for (let i = left; i <= right; i += 1) items.push(i)
  if (right < total - 1) {
    items.push('…')
  }
  items.push(total)
  return items
})

function go(target: number): void {
  if (target < 1 || target > pageCount.value || target === props.page) {
    return
  }
  emit('update:page', target)
}

const btnBase = 'inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm outline-none transition-colors focus-visible:shadow-[var(--ring-focus)]'
</script>

<template>
  <nav class="flex items-center gap-1" aria-label="Pagination">
    <button
      type="button"
      class="text-muted hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
      :class="btnBase"
      :disabled="page <= 1"
      aria-label="Previous page"
      @click="go(page - 1)"
    >
      <Icon name="tabler:chevron-left" class="h-4 w-4" />
    </button>
    <template v-for="(item, idx) in visiblePages" :key="`${item}-${idx}`">
      <button
        v-if="typeof item === 'number'"
        type="button"
        :class="[
          btnBase,
          item === page
            ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)]'
            : 'text-foreground hover:bg-muted',
        ]"
        :aria-current="item === page ? 'page' : undefined"
        @click="go(item)"
      >
        {{ item }}
      </button>
      <span v-else class="px-1 text-muted">…</span>
    </template>
    <button
      type="button"
      class="text-muted hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
      :class="btnBase"
      :disabled="page >= pageCount"
      aria-label="Next page"
      @click="go(page + 1)"
    >
      <Icon name="tabler:chevron-right" class="h-4 w-4" />
    </button>
  </nav>
</template>
