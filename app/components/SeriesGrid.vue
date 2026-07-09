<script setup lang="ts">
import type { FileSummary } from '~/types/file'
import type { SeriesSummary } from '~/types/series'
import { computed, onMounted, reactive } from 'vue'
import { ensureArthashReady } from '~/utils/arthash'

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

const SKELETON_COUNT = 6

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

function resolveCover(item: SeriesSummary): FileSummary | null {
  if (item.cover) {
    return item.cover
  }
  return (item.previews ?? [])[0] ?? null
}

function resolveCoverSrc(file: FileSummary): string {
  return (file.imageUrl ?? '').trim()
}

const loadedCovers = reactive(new Set<number>())

function markCoverLoaded(id: number): void {
  loadedCovers.add(id)
}

function isCoverLoaded(id: number): boolean {
  return loadedCovers.has(id)
}

function onCoverImageRef(id: number, element: Element | null): void {
  if (!(element instanceof HTMLImageElement)) {
    return
  }
  if (element.complete && element.naturalWidth > 0) {
    markCoverLoaded(id)
  }
}

onMounted(() => {
  void ensureArthashReady()
})
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
    class="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3"
    aria-hidden="true"
  >
    <div v-for="i in SKELETON_COUNT" :key="i" class="space-y-3">
      <USkeleton class="aspect-[3/2] w-full rounded-lg" />
      <USkeleton class="h-4 w-2/3" />
      <USkeleton class="h-3 w-full" />
      <USkeleton class="h-3 w-1/3" />
    </div>
  </div>

  <div
    v-else-if="!hasSeries"
    class="border-y border-border-muted py-20 text-center text-sm text-muted"
  >
    {{ resolvedEmptyText }}
  </div>

  <ul v-else class="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
    <li v-for="item in seriesList" :key="item.id">
      <NuxtLink
        :to="`/series/${item.slug}`"
        class="group block focus-visible:outline-none"
      >
        <div
          class="relative aspect-[3/2] overflow-hidden rounded-lg bg-muted ring-1 ring-inset ring-border-muted/40 transition-shadow duration-300 group-hover:ring-border-muted group-focus-visible:ring-border-muted"
        >
          <template v-if="resolveCover(item)">
            <img
              :ref="el => onCoverImageRef(resolveCover(item)!.id, el as Element | null)"
              :src="resolveCoverSrc(resolveCover(item)!)"
              :alt="resolveTitle(item)"
              class="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
              loading="lazy"
              decoding="async"
              @load="markCoverLoaded(resolveCover(item)!.id)"
            >
            <ArthashPlaceholder
              :arthash="resolveCover(item)!.arthash"
              :loaded="isCoverLoaded(resolveCover(item)!.id)"
            />
          </template>
          <div v-else class="absolute inset-0 flex items-center justify-center text-xs text-muted">
            {{ t('series.list.noCover') }}
          </div>

          <div class="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/40 via-black/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

          <span class="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-sm bg-bg/85 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-highlighted backdrop-blur-sm">
            <Icon name="tabler:photo" class="h-3 w-3" />
            {{ item.fileCount }}
          </span>
        </div>

        <div class="mt-3 space-y-1.5 px-0.5">
          <h3
            class="truncate text-[15px] font-medium leading-snug tracking-tight"
            :class="isUncategorized(item) ? 'text-muted' : 'text-highlighted'"
          >
            {{ resolveTitle(item) }}
          </h3>
          <p
            v-if="resolveDescription(item)"
            class="line-clamp-2 min-h-[2.4em] text-[12.5px] leading-relaxed text-muted"
          >
            {{ resolveDescription(item) }}
          </p>
          <p v-if="formatDate(item.updatedAt)" class="pt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            {{ formatDate(item.updatedAt) }}
          </p>
        </div>
      </NuxtLink>
    </li>
  </ul>
</template>
