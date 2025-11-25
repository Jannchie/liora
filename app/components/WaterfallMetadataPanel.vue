<script setup lang="ts">
import type { MetadataEntry } from '~/types/gallery'

defineProps<{
  hasMetadata: boolean
  metadataEntries: MetadataEntry[]
  exposureEntries: MetadataEntry[]
}>()

const { t } = useI18n()
</script>

<template>
  <div class="rounded-lg border border-default/20 bg-elevated/80 text-sm text-default">
    <div class="flex items-center justify-between border-b border-default/10 px-3 py-2 text-xs uppercase tracking-wide text-muted">
      <div class="flex items-center gap-2">
        <Icon name="carbon:information" class="h-4 w-4" />
        <span>{{ t('gallery.metadata.section') }}</span>
      </div>
      <span class="rounded-full bg-default/60 px-2 py-0.5 text-[11px] font-semibold text-highlighted ring-1 ring-default/15">
        {{ metadataEntries.length + exposureEntries.length }}
      </span>
    </div>
    <div v-if="hasMetadata" class="space-y-3 p-3">
      <div v-if="exposureEntries.length > 0" class="space-y-3">
        <div class="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
          <Icon name="carbon:settings-adjust" class="h-4 w-4" />
          <span>{{ t('gallery.metadata.exposure') }}</span>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div
            v-for="item in exposureEntries"
            :key="item.label"
            class="flex items-center gap-3 rounded-md bg-default/60 px-2 py-2 ring-1 ring-default/15"
            :aria-label="`${item.label}: ${item.value}`"
          >
            <Icon :name="item.icon" class="h-4 w-4 text-muted" />
            <div class="flex flex-col leading-tight">
              <span class="text-[10px] uppercase tracking-wide text-muted">{{ item.label }}</span>
              <span class="text-sm font-semibold text-highlighted">{{ item.value }}</span>
            </div>
          </div>
        </div>
      </div>
      <div v-if="metadataEntries.length > 0" class="space-y-2">
        <div
          v-for="item in metadataEntries"
          :key="item.label"
          class="grid gap-1 rounded-md bg-default/60 px-2 py-2 ring-1 ring-default/15"
        >
          <p class="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted">
            <Icon :name="item.icon" class="h-4 w-4" />
            <span>{{ item.label }}</span>
          </p>
          <p class="text-base leading-relaxed text-highlighted">
            {{ item.value }}
          </p>
        </div>
      </div>
    </div>
    <div v-else class="px-3 py-4 text-sm text-muted">
      <p class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
        <Icon name="carbon:warning" class="h-4 w-4" />
        <span>{{ t('gallery.metadata.section') }}</span>
      </p>
      <p class="mt-2 flex items-center gap-2 text-highlighted">
        <Icon name="carbon:information" class="h-4 w-4 text-muted" />
        <span>{{ t('gallery.metadata.empty') }}</span>
      </p>
    </div>
  </div>
</template>
