<script setup lang="ts">
import type { SeriesSummary } from '~/types/series'
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    seriesList: SeriesSummary[]
    pending: boolean
    errorMessage?: string | null
    emptyText?: string
  }>(),
  {
    errorMessage: null,
    emptyText: '',
  },
)

const emit = defineEmits<{
  (event: 'retry'): void
}>()

const { t } = useI18n()

const hasSeries = computed(() => props.seriesList.length > 0)
const resolvedEmptyText = computed(() => {
  if (props.emptyText && props.emptyText.trim().length > 0) {
    return props.emptyText
  }
  return t('series.list.empty')
})

function formatDate(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return ''
  }
  return parsed.toLocaleDateString()
}

function isUncategorized(item: SeriesSummary): boolean {
  return item.slug === '__uncategorized__'
}

function resolveTitle(item: SeriesSummary): string {
  if (isUncategorized(item)) {
    return t('series.special.uncategorizedTitle')
  }
  return item.title
}

function resolveDescription(item: SeriesSummary): string {
  if (isUncategorized(item)) {
    return t('series.special.uncategorizedDescription')
  }
  return item.description
}
</script>

<template>
  <UAlert
    v-if="errorMessage"
    color="error"
    variant="soft"
    :title="t('series.list.loadFailed')"
    :description="errorMessage"
  >
    <template #actions>
      <UButton size="sm" color="error" variant="soft" icon="tabler:refresh" @click="emit('retry')">
        {{ t('common.actions.retry') }}
      </UButton>
    </template>
  </UAlert>

  <div
    v-else-if="pending"
    class="flex min-h-60 items-center justify-center text-sm text-muted"
  >
    {{ t('common.loading') }}
  </div>

  <div
    v-else-if="!hasSeries"
    class="rounded-lg border border-default/40 bg-default/70 p-6 text-center text-sm text-muted"
  >
    {{ resolvedEmptyText }}
  </div>

  <div v-else class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
    <NuxtLink
      v-for="item in seriesList"
      :key="item.id"
      :to="`/series/${item.slug}`"
      class="group overflow-hidden rounded-lg border border-default/40 bg-default/70 transition hover:border-primary/40"
    >
      <div class="aspect-[4/3] w-full bg-default/80">
        <img
          v-if="item.cover"
          :src="item.cover.imageUrl"
          :alt="resolveTitle(item)"
          class="h-full w-full object-cover"
          loading="lazy"
        >
        <div v-else class="flex h-full w-full items-center justify-center text-xs text-muted">
          {{ t('series.list.noCover') }}
        </div>
      </div>
      <div class="space-y-2 p-4">
        <h2 class="text-base font-semibold text-highlighted group-hover:text-primary">
          {{ resolveTitle(item) }}
        </h2>
        <p class="line-clamp-2 min-h-10 text-sm text-muted">
          {{ resolveDescription(item) }}
        </p>
        <div class="flex items-center justify-between text-xs text-muted">
          <span>{{ t('series.list.count', { count: item.fileCount }) }}</span>
          <span>{{ formatDate(item.updatedAt) }}</span>
        </div>
      </div>
    </NuxtLink>
  </div>
</template>
