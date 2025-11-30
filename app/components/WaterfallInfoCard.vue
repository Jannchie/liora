<script setup lang="ts">
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

const { t } = useI18n()
</script>

<template>
  <div
    class="flex h-full w-full flex-col justify-between rounded-sm bg-default/60 p-4 text-default ring-1 ring-default/20"
    :style="{ height: `${displaySize.height}px` }"
  >
    <div class="space-y-3">
      <div class="space-y-1">
        <h2 class="home-title-font text-xl font-semibold leading-tight text-highlighted">
          {{ siteName }}
        </h2>
        <p class="text-sm leading-relaxed text-muted">
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
      <div class="flex items-center justify-center gap-2 text-default">
        <Icon name="mdi:image-multiple-outline" class="h-4 w-4 text-muted" />
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
          size="lg"
          class="text-muted"
          :icon="link.icon"
          :aria-label="link.label"
        />
      </div>
    </div>
  </div>
</template>
