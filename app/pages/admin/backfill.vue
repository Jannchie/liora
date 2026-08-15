<script setup lang="ts">
import { computed, reactive, ref } from 'vue'

interface BackfillCommand {
  key: 'arthash' | 'exif' | 'histogram' | 'orientation' | 'series'
  endpoint: string
  icon: string
}

const { t } = useI18n()
definePageMeta({
  middleware: 'admin-auth',
})

const toast = useToast()

const pageTitle = computed(() => t('admin.backfill.seoTitle'))
const pageDescription = computed(() => t('admin.backfill.seoDescription'))

useSeoMeta({
  title: () => pageTitle.value,
  ogTitle: () => pageTitle.value,
  description: () => pageDescription.value,
  ogDescription: () => pageDescription.value,
  robots: 'noindex, nofollow',
})

const commands = computed<BackfillCommand[]>(() => [
  { key: 'arthash', endpoint: '/api/files/backfill-arthash', icon: 'tabler:hash' },
  { key: 'exif', endpoint: '/api/files/backfill-exif', icon: 'tabler:camera' },
  { key: 'histogram', endpoint: '/api/files/backfill-histogram', icon: 'tabler:chart-bar' },
  { key: 'orientation', endpoint: '/api/files/backfill-orientation', icon: 'tabler:aspect-ratio' },
  { key: 'series', endpoint: '/api/files/backfill-series', icon: 'tabler:stack-3' },
])

const runningKey = ref<BackfillCommand['key'] | null>(null)
const results = reactive<Partial<Record<BackfillCommand['key'], string>>>({})

function formatResult(key: BackfillCommand['key'], data: Record<string, unknown>): string {
  const total = Number(data.total ?? data.totalFiles ?? 0)
  const updated = Number(data.updated ?? 0)
  const skipped = Number(data.skipped ?? 0)
  if (key === 'orientation') {
    return t('admin.backfill.result.orientation', {
      total,
      checked: Number(data.checked ?? 0),
      updated,
      failed: Number(data.failed ?? 0),
    })
  }
  if (key === 'series') {
    return t('admin.backfill.result.series', {
      totalFiles: total,
      createdSeries: Number(data.createdSeries ?? 0),
      linkedFiles: Number(data.linkedFiles ?? 0),
    })
  }
  return t('admin.backfill.result.generic', { total, updated, skipped })
}

async function run(command: BackfillCommand): Promise<void> {
  if (runningKey.value) {
    return
  }
  runningKey.value = command.key
  try {
    const data = await $fetch<Record<string, unknown>>(command.endpoint, { method: 'POST' })
    results[command.key] = formatResult(command.key, data)
    toast.add({
      title: t('admin.backfill.toast.success'),
      description: t(`admin.backfill.commands.${command.key}.title`),
      color: 'success',
    })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : t('admin.backfill.toast.failedFallback')
    toast.add({
      title: t('admin.backfill.toast.failed'),
      description: message,
      color: 'error',
    })
  }
  finally {
    runningKey.value = null
  }
}
</script>

<template>
  <div class="min-h-screen">
    <UContainer rails class="space-y-10 py-10">
      <AdminNav />

      <UPageHeader
        :eyebrow="t('admin.nav.label')"
        icon="tabler:shield-check"
        :title="t('admin.backfill.title')"
        :description="t('admin.backfill.seoDescription')"
      />

      <UAlert
        color="warning"
        variant="soft"
        icon="tabler:alert-triangle"
        :title="t('admin.backfill.warningTitle')"
        :description="t('admin.backfill.warningDescription')"
      />

      <div class="grid gap-4 sm:grid-cols-2">
        <UCard
          v-for="command in commands"
          :key="command.key"
        >
          <template #header>
            <div class="flex items-start gap-3">
              <Icon :name="command.icon" class="mt-0.5 h-5 w-5 shrink-0 text-muted" />
              <div class="min-w-0 space-y-1">
                <h3 class="text-sm font-semibold text-highlighted">
                  {{ t(`admin.backfill.commands.${command.key}.title`) }}
                </h3>
                <p class="text-xs text-muted">
                  {{ t(`admin.backfill.commands.${command.key}.description`) }}
                </p>
              </div>
            </div>
          </template>

          <div class="flex items-center justify-between gap-4">
            <p class="min-w-0 text-sm text-muted">
              <template v-if="results[command.key]">
                {{ results[command.key] }}
              </template>
              <template v-else>
                {{ t('admin.backfill.result.none') }}
              </template>
            </p>
            <UButton
              color="primary"
              size="sm"
              icon="tabler:play"
              :loading="runningKey === command.key"
              :disabled="runningKey !== null"
              @click="run(command)"
            >
              {{ runningKey === command.key ? t('admin.backfill.running') : t('admin.backfill.run') }}
            </UButton>
          </div>
        </UCard>
      </div>
    </UContainer>
  </div>
</template>
