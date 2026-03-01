<script setup lang="ts">
import type { SocialLink } from '~/types/gallery'

withDefaults(
  defineProps<{
    title: string
    socialLinks?: SocialLink[]
    showHeaderInfo?: boolean
    isAuthenticated?: boolean
  }>(),
  {
    socialLinks: () => [],
    showHeaderInfo: true,
    isAuthenticated: false,
  },
)

const { t } = useI18n()
</script>

<template>
  <header
    v-if="showHeaderInfo"
    class="sticky inset-x-0 top-0 z-30 w-full border-b border-default/20 bg-default"
  >
    <div class="mx-auto flex w-full flex-col items-center gap-2 px-3 py-2 text-center md:max-w-500 md:flex-row md:items-center md:justify-between md:gap-3 md:px-4 md:py-3 md:text-left">
      <div class="flex w-full flex-col items-center gap-1 md:flex-1 md:flex-row md:items-center md:gap-3">
        <h1 class="home-title-font text-sm font-semibold leading-tight text-highlighted md:text-lg">
          {{ title }}
        </h1>
        <div class="flex flex-wrap items-center justify-center gap-2 text-muted md:justify-start">
          <UButton
            v-for="link in socialLinks"
            :key="link.label"
            :href="link.url"
            target="_blank"
            rel="noopener noreferrer"
            variant="soft"
            color="neutral"
            square
            size="sm"
            class="text-muted"
            :icon="link.icon"
            :aria-label="link.label"
          />
        </div>
      </div>
      <div class="flex items-center gap-2 md:shrink-0">
        <UButton
          v-if="isAuthenticated"
          to="/admin"
          color="primary"
          variant="soft"
          size="sm"
          icon="tabler:shield-check"
          class="shrink-0"
        >
          {{ t('admin.nav.label') }}
        </UButton>
        <LanguageSwitcher class="hidden md:block" />
      </div>
    </div>
  </header>
  <div
    v-else
    class="mx-auto flex flex-wrap items-center justify-end gap-2 px-3 py-2 md:max-w-500 md:flex-nowrap md:gap-3 md:px-4 md:py-3"
  >
    <UButton
      v-if="isAuthenticated"
      to="/admin"
      color="primary"
      variant="soft"
      size="sm"
      class="shrink-0"
      icon="tabler:shield-check"
    >
      {{ t('admin.nav.label') }}
    </UButton>
    <LanguageSwitcher class="hidden md:block" />
  </div>
</template>
