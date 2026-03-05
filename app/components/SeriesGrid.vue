<script setup lang="ts">
import type { FileSummary } from '~/types/file'
import type { SeriesSummary } from '~/types/series'
import { computed } from 'vue'
import SeriesPreviewWaterfall from '~/components/SeriesPreviewWaterfall.vue'

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

function resolvePreviewFiles(item: SeriesSummary): FileSummary[] {
  const resolved: FileSummary[] = []
  const seen = new Set<number>()
  const append = (entry: FileSummary | null | undefined): void => {
    if (!entry || seen.has(entry.id)) {
      return
    }
    seen.add(entry.id)
    resolved.push(entry)
  }

  for (const entry of item.previews ?? []) {
    append(entry)
  }
  append(item.cover)
  return resolved
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

const previewMap = computed(() => {
  const map = new Map<number, FileSummary[]>()
  for (const item of props.seriesList) {
    map.set(item.id, resolvePreviewFiles(item))
  }
  return map
})

function resolveMobilePreviews(item: SeriesSummary): FileSummary[] {
  return (previewMap.value.get(item.id) ?? []).slice(0, 6)
}

function resolveDesktopPreviews(item: SeriesSummary): FileSummary[] {
  return (previewMap.value.get(item.id) ?? []).slice(0, 12)
}

function resolveUpdatedLabel(item: SeriesSummary): string {
  const formatted = formatDate(item.updatedAt)
  if (!formatted) {
    return ''
  }
  return t('series.list.updatedAt', { date: formatted })
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

  <div v-else class="grid gap-6 xl:grid-cols-2">
    <NuxtLink
      v-for="item in seriesList"
      :key="item.id"
      :to="`/series/${item.slug}`"
      class="group grid overflow-hidden rounded-lg border border-default/40 bg-default/70 transition-colors duration-200 hover:border-primary/40 hover:bg-default/90 xl:h-full xl:aspect-2/1 xl:grid-cols-[34%_66%]"
    >
      <div class="flex h-full flex-col gap-3 p-4 md:p-5">
        <div class="space-y-3">
          <h2 class="line-clamp-2 text-lg font-semibold text-highlighted transition-colors group-hover:text-primary">
            {{ resolveTitle(item) }}
          </h2>
          <p class="line-clamp-3 text-sm leading-relaxed text-muted xl:line-clamp-8">
            {{ resolveDescription(item) }}
          </p>
        </div>
        <div class="mt-auto space-y-1 text-xs text-muted">
          <p>{{ t('series.list.count', { count: item.fileCount }) }}</p>
          <p v-if="resolveUpdatedLabel(item).length > 0">
            {{ resolveUpdatedLabel(item) }}
          </p>
        </div>
      </div>

      <div class="p-1 xl:hidden">
        <SeriesPreviewWaterfall
          :previews="resolveMobilePreviews(item)"
          :title="resolveTitle(item)"
          :columns="3"
          :fallback-text="t('series.list.noCover')"
        />
      </div>

      <div class="hidden h-full overflow-hidden p-1 xl:block">
        <SeriesPreviewWaterfall
          :previews="resolveDesktopPreviews(item)"
          :title="resolveTitle(item)"
          :columns="2"
          :fallback-text="t('series.list.noCover')"
        />
      </div>
    </NuxtLink>
  </div>
</template>
