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
  <!--
    The site's wall label when it sits inside the waterfall: name and
    description up top, then a hairline-ruled foot with the mono work
    count and the social links as ghost controls.
  -->
  <div class="flex h-full w-full flex-col justify-between text-default" :style="{ height: `${displaySize.height}px` }">
    <div class="space-y-2 px-4 pt-4">
      <h2 class="flex items-center gap-2.5 text-lg font-semibold leading-tight tracking-[-0.01em] text-highlighted">
        <Icon name="jannchie:aperture" class="h-5 w-5 shrink-0" />
        <span class="min-w-0">{{ siteName }}</span>
      </h2>
      <p class="text-[13px] leading-relaxed text-dimmed">
        {{ siteDescription }}
      </p>
      <p v-if="photoCount === 0 && !isLoading" class="text-[13px] text-dimmed">
        {{ emptyText }}
      </p>
    </div>
    <div class="border-t border-border">
      <div class="flex items-baseline justify-between gap-3 px-4 py-2.5">
        <span class="label-caption">{{ t('gallery.totalWorks') }}</span>
        <span class="num-tabular text-[13px] text-highlighted">
          {{ photoCount }}
        </span>
      </div>
      <div v-if="socialLinks.length > 0" class="flex flex-wrap items-center gap-0.5 border-t border-border px-2.5 py-2">
        <UButton
          v-for="link in socialLinks"
          :key="link.label"
          :href="link.url"
          target="_blank"
          rel="noopener noreferrer"
          variant="ghost"
          color="neutral"
          square
          :size="socialButtonSize"
          :icon="link.icon"
          :aria-label="link.label"
          :title="link.label"
        />
      </div>
    </div>
  </div>
</template>
