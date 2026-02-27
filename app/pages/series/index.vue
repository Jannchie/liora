<script setup lang="ts">
import type { SessionState } from '~/types/auth'
import type { SeriesSummary } from '~/types/series'
import { computed } from 'vue'

const { t } = useI18n()

const pageTitle = computed(() => t('series.list.seoTitle'))
const pageDescription = computed(() => t('series.list.seoDescription'))

useSeoMeta({
  title: () => pageTitle.value,
  ogTitle: () => pageTitle.value,
  description: () => pageDescription.value,
  ogDescription: () => pageDescription.value,
})

const { data: seriesData, pending, error, refresh } = await useFetch<SeriesSummary[]>('/api/series', {
  default: () => [],
  server: false,
})

const { data: sessionState } = useFetch<SessionState>('/api/auth/session', {
  default: () => ({ authenticated: false }),
  server: false,
})

const seriesList = computed(() => seriesData.value ?? [])
const isAuthenticated = computed(() => sessionState.value?.authenticated ?? false)
const listErrorMessage = computed(() => error.value?.message ?? null)
</script>

<template>
  <div class="min-h-screen py-8">
    <UContainer class="space-y-6">
      <header class="flex flex-wrap items-center justify-between gap-3">
        <div class="space-y-1">
          <h1 class="text-2xl font-semibold text-highlighted">
            {{ t('series.list.title') }}
          </h1>
          <p class="text-sm text-muted">
            {{ t('series.list.description') }}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <UButton to="/" variant="soft" color="neutral" icon="tabler:arrow-left">
            {{ t('series.common.backHome') }}
          </UButton>
          <UButton
            v-if="isAuthenticated"
            to="/admin/series"
            variant="soft"
            color="primary"
            icon="tabler:settings"
          >
            {{ t('series.list.manage') }}
          </UButton>
        </div>
      </header>

      <SeriesGrid
        :series-list="seriesList"
        :pending="pending"
        :error-message="listErrorMessage"
        @retry="refresh"
      />
    </UContainer>
  </div>
</template>
