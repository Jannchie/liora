import type { MaybeRefOrGetter } from 'vue'
import { useSeoMeta } from '#imports'
import { computed, toValue } from 'vue'

interface PageSeoImageOptions {
  title?: MaybeRefOrGetter<string>
  description?: MaybeRefOrGetter<string>
  itemCount?: MaybeRefOrGetter<number | string>
}

interface PageSeoOptions {
  title: MaybeRefOrGetter<string>
  description?: MaybeRefOrGetter<string>
  indexable?: boolean
  image?: PageSeoImageOptions
}

const NO_INDEX_ROBOTS = 'noindex, nofollow'

function resolveString(input: MaybeRefOrGetter<string> | undefined, fallback = ''): string {
  if (!input) {
    return fallback
  }
  const value = toValue(input)
  return typeof value === 'string' ? value.trim() : fallback
}

function resolveNumber(input: MaybeRefOrGetter<number | string> | undefined, fallback = 0): number {
  if (input === undefined) {
    return fallback
  }
  const value = toValue(input)
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return fallback
}

export function usePageSeo(options: PageSeoOptions): void {
  const resolvedTitle = computed(() => resolveString(options.title))
  const resolvedDescription = computed(() => resolveString(options.description, ''))
  const ogTitle = computed(() => resolveString(options.image?.title, resolvedTitle.value))
  const ogDescription = computed(() => resolveString(options.image?.description, resolvedDescription.value))
  const itemCount = computed(() => Math.max(0, resolveNumber(options.image?.itemCount, 0)))
  const robotsValue = computed(() => (options.indexable === false ? NO_INDEX_ROBOTS : undefined))

  useSeoMeta({
    title: () => resolvedTitle.value,
    ogTitle: () => ogTitle.value,
    description: () => resolvedDescription.value,
    ogDescription: () => ogDescription.value,
    twitterCard: 'summary_large_image',
    robots: () => robotsValue.value,
  })

  watchEffect(() => {
    defineOgImageComponent('LioraCard', {
      title: ogTitle.value,
      description: ogDescription.value,
      itemCount: itemCount.value,
    })
  })
}
