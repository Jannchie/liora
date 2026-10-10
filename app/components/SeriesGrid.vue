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
  <div v-if="errorMessage" class="wire-band">
    <UAlert
      color="error"
      variant="soft"
      :title="t('series.list.loadFailed')"
      :description="errorMessage"
    >
      <template #actions>
        <UButton size="sm" color="error" variant="soft" icon="jannchie:refresh" @click="emit('retry')">
          {{ t('common.actions.retry') }}
        </UButton>
      </template>
    </UAlert>
  </div>

  <!--
    Series are cells of one hairline grid, like the icons site's glyph
    grid: each cell draws only its right and bottom rule, and the grid
    pulls 1px into the shell's right edge so the last column's rule lands
    on the shell's own line instead of doubling it.
  -->
  <div
    v-else-if="pending"
    class="-mr-px grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
    aria-hidden="true"
  >
    <div v-for="i in SKELETON_COUNT" :key="i" class="border-b border-r border-border">
      <USkeleton class="aspect-[3/2] w-full rounded-none" />
      <div class="space-y-2 border-t border-border px-4 pb-5 pt-3.5 sm:px-5">
        <USkeleton class="h-4 w-2/3" />
        <USkeleton class="h-3 w-full" />
        <USkeleton class="h-3 w-1/4" />
      </div>
    </div>
  </div>

  <div
    v-else-if="!hasSeries"
    class="border-b border-border px-4 py-20 text-center text-[13px] text-dimmed"
  >
    {{ resolvedEmptyText }}
  </div>

  <ul v-else class="-mr-px grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
    <li v-for="item in seriesList" :key="item.id" class="border-b border-r border-border">
      <NuxtLink
        :to="`/series/${item.slug}`"
        class="group flex h-full flex-col outline-none transition-colors hover:bg-muted focus-visible:bg-muted"
      >
        <div class="relative aspect-[3/2] overflow-hidden border-b border-border bg-muted">
          <template v-if="resolveCover(item)">
            <img
              :ref="el => onCoverImageRef(resolveCover(item)!.id, el as Element | null)"
              :src="resolveCoverSrc(resolveCover(item)!)"
              :alt="resolveTitle(item)"
              class="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02]"
              loading="lazy"
              decoding="async"
              @load="markCoverLoaded(resolveCover(item)!.id)"
            >
            <ArthashPlaceholder
              :arthash="resolveCover(item)!.arthash"
              :loaded="isCoverLoaded(resolveCover(item)!.id)"
            />
          </template>
          <div v-else class="label-caption absolute inset-0 flex items-center justify-center">
            {{ t('series.list.noCover') }}
          </div>
        </div>

        <div class="flex flex-1 flex-col px-4 pb-4 pt-3.5 sm:px-5">
          <h3 class="flex min-w-0 items-baseline gap-2.5">
            <span
              class="truncate text-[14px] font-semibold tracking-[-0.01em]"
              :class="isUncategorized(item) ? 'text-muted' : 'text-highlighted'"
            >{{ resolveTitle(item) }}</span>
            <small
              class="shrink-0 font-mono text-xs font-normal text-dimmed"
              :title="t('series.list.count', { count: item.fileCount })"
            >{{ item.fileCount }}</small>
          </h3>
          <p
            v-if="resolveDescription(item)"
            class="mt-1 line-clamp-2 text-[13px] leading-relaxed text-dimmed"
          >
            {{ resolveDescription(item) }}
          </p>
          <p
            v-if="formatDate(item.updatedAt)"
            class="mt-auto pt-3 font-mono text-[11.5px] text-subtle"
          >
            {{ formatDate(item.updatedAt) }}
          </p>
        </div>
      </NuxtLink>
    </li>
  </ul>
</template>
