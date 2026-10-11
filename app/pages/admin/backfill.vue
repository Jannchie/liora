<script setup lang="ts">
import { computed, reactive, ref } from 'vue'

interface BackfillCommand {
  key: 'arthash' | 'exif' | 'recipe' | 'histogram' | 'orientation' | 'series'
  endpoint: string
  icon: string
}

const { t } = useI18n()
definePageMeta({
  layout: 'admin',
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
  { key: 'arthash', endpoint: '/api/files/backfill-arthash', icon: 'jannchie:hash' },
  { key: 'exif', endpoint: '/api/files/backfill-exif', icon: 'jannchie:camera' },
  { key: 'recipe', endpoint: '/api/files/backfill-recipe', icon: 'jannchie:sliders' },
  { key: 'histogram', endpoint: '/api/files/backfill-histogram', icon: 'jannchie:chart-bar' },
  { key: 'orientation', endpoint: '/api/files/backfill-orientation', icon: 'jannchie:aspect-ratio' },
  { key: 'series', endpoint: '/api/files/backfill-series', icon: 'jannchie:layers' },
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
  <div>
    <UPageHeader
      :title="t('admin.backfill.title')"
      :description="t('admin.backfill.seoDescription')"
    />

    <div class="wire-band">
      <UAlert
        color="warning"
        variant="soft"
        icon="jannchie:alert-triangle"
        :title="t('admin.backfill.warningTitle')"
        :description="t('admin.backfill.warningDescription')"
      />
    </div>

    <!-- Commands form one hairline grid with shared edges: the band above
         supplies the top rule, each cell draws only its right and bottom,
         and the last column's right edge tucks under the shell's side rule
         (-mr-px) so no line doubles. -->
    <div class="grid sm:-mr-px sm:grid-cols-2">
      <section
        v-for="command in commands"
        :key="command.key"
        class="flex flex-col gap-4 border-b border-border px-4 py-6 sm:border-r sm:px-8 sm:py-7"
      >
        <div class="flex items-start gap-3">
          <Icon :name="command.icon" class="mt-0.5 h-4 w-4 shrink-0 text-dimmed" />
          <div class="min-w-0 space-y-1">
            <h3 class="text-[13.5px] font-semibold tracking-[-0.01em] text-highlighted">
              {{ t(`admin.backfill.commands.${command.key}.title`) }}
            </h3>
            <p class="text-[13px] leading-relaxed text-dimmed">
              {{ t(`admin.backfill.commands.${command.key}.description`) }}
            </p>
          </div>
        </div>

        <div class="mt-auto flex items-center justify-between gap-4 pl-7">
          <p class="num-tabular min-w-0 font-mono text-xs" :class="results[command.key] ? 'text-toned' : 'text-subtle'">
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
            icon="jannchie:play"
            class="shrink-0"
            :loading="runningKey === command.key"
            :disabled="runningKey !== null"
            @click="run(command)"
          >
            {{ runningKey === command.key ? t('admin.backfill.running') : t('admin.backfill.run') }}
          </UButton>
        </div>
      </section>
      <!-- Odd count: a blank cell closes the last row so its rules stay whole. -->
      <div
        v-if="commands.length % 2 === 1"
        class="hidden border-b border-r border-border sm:block"
        aria-hidden="true"
      />
    </div>
  </div>
</template>
