<script setup lang="ts" generic="Row extends object">
/*
 * Table — the wireframe ledger: an uppercase mono header, then rows
 * divided by single hairlines (each row draws only its bottom edge, so
 * no line is ever doubled) and a sunken fill under the hovered row.
 */
import { computed } from 'vue'

interface Column<R> {
  id?: string
  header?: string
  accessorKey?: string
  accessorFn?: (row: R) => unknown
}

const props = withDefaults(defineProps<{
  columns: Column<Row>[]
  data?: Row[]
  loading?: boolean
  empty?: string
  ui?: {
    wrapper?: string
    table?: string
    thead?: string
    tbody?: string
    th?: string
    td?: string
    tr?: string
  }
}>(), {
  data: () => [],
})

function resolveValue(row: Row, column: Column<Row>): unknown {
  if (column.accessorFn) {
    return column.accessorFn(row)
  }
  if (column.accessorKey) {
    return (row as Record<string, unknown>)[column.accessorKey]
  }
  return undefined
}

function cellSlotName(column: Column<Row>): string {
  return `${column.id ?? column.accessorKey ?? ''}-cell`
}

function headerSlotName(column: Column<Row>): string {
  return `${column.id ?? column.accessorKey ?? ''}-header`
}

const isEmpty = computed(() => !props.loading && props.data.length === 0)
</script>

<template>
  <div class="relative w-full" :class="ui?.wrapper">
    <table class="w-full border-separate border-spacing-0" :class="ui?.table">
      <thead :class="ui?.thead">
        <tr :class="ui?.tr">
          <th
            v-for="column in columns"
            :key="column.id ?? column.accessorKey"
            class="border-b border-border px-3 py-2 text-left text-[11px] font-normal uppercase tracking-[0.06em] text-dimmed"
            :class="ui?.th"
          >
            <slot :name="headerSlotName(column)" :column="(column as Column<Row>)">
              {{ column.header }}
            </slot>
          </th>
        </tr>
      </thead>
      <tbody :class="ui?.tbody">
        <tr v-if="loading">
          <td :colspan="columns.length" class="border-b border-border py-10 text-center text-[13px] text-dimmed">
            <span class="inline-flex items-center gap-2">
              <Icon name="jannchie:loader" class="h-4 w-4 animate-spin" />
              Loading…
            </span>
          </td>
        </tr>
        <tr v-else-if="isEmpty">
          <td :colspan="columns.length" class="border-b border-border py-10 text-center text-[13px] text-dimmed">
            {{ empty ?? '—' }}
          </td>
        </tr>
        <tr
          v-for="(row, rowIndex) in data"
          v-else
          :key="rowIndex"
          class="transition-colors hover:bg-muted"
          :class="ui?.tr"
        >
          <td
            v-for="column in columns"
            :key="column.id ?? column.accessorKey"
            class="border-b border-border px-3 py-2.5 text-[13px] text-foreground"
            :class="ui?.td"
          >
            <slot
              :name="cellSlotName(column)"
              :row="{ original: row, index: rowIndex }"
              :column="(column as Column<Row>)"
              :get-value="() => resolveValue(row, column)"
            >
              {{ resolveValue(row, column) }}
            </slot>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
