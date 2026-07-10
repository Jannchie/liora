<script setup lang="ts">
import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'
import { computed } from 'vue'

interface SocialLink {
  label: string
  url: string
  icon: string
}

interface DisplaySize {
  width: number
  height: number
}

withDefaults(
  defineProps<{
    siteName: string
    siteDescription: string
    photoCount: number
    socialLinks?: SocialLink[]
    emptyText: string
    isLoading: boolean
    displaySize: DisplaySize
  }>(),
  {
    socialLinks: () => [],
  },
)

const breakpoints = useBreakpoints(breakpointsTailwind)
const isMobile = breakpoints.smaller('md')
const socialButtonSize = computed(() => (isMobile.value ? 'md' : 'lg'))

const { t } = useI18n()
</script>

<template>
  <div
    class="flex h-full w-full flex-col justify-between p-4 text-default"
    :style="{ height: `${displaySize.height}px` }"
  >
    <div class="space-y-3">
      <div class="space-y-2">
        <h2 class="font-title text-2xl font-semibold leading-tight text-highlighted">
          {{ siteName }}
        </h2>
        <p class="font-prose text-sm leading-relaxed text-muted">
          {{ siteDescription }}
        </p>
      </div>
      <p
        v-if="photoCount === 0 && !isLoading"
        class="text-xs text-muted"
      >
        {{ emptyText }}
      </p>
    </div>
    <div class="space-y-3 text-sm text-muted">
      <div class="label-caption num-tabular flex items-center justify-center gap-1.5">
        <span>{{ t('gallery.totalWorks') }}</span>
        <span class="text-highlighted">
          {{ photoCount }}
        </span>
      </div>
      <div
        v-if="socialLinks.length > 0"
        class="flex flex-wrap items-center justify-center gap-3"
      >
        <UButton
          v-for="link in socialLinks"
          :key="link.label"
          :href="link.url"
          target="_blank"
          rel="noopener noreferrer"
          variant="soft"
          color="neutral"
          square
          :size="socialButtonSize"
          class="text-muted"
          :icon="link.icon"
          :aria-label="link.label"
        />
      </div>
    </div>
  </div>
</template>
