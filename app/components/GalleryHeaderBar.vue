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
    class="sticky inset-x-0 top-0 z-30 w-full border-b border-border-muted bg-default"
  >
    <div class="mx-auto flex w-full flex-col items-center gap-2 px-3 py-3 text-center md:max-w-500 md:flex-row md:items-center md:justify-between md:gap-3 md:px-4 md:py-4 md:text-left">
      <div class="flex w-full flex-col items-center gap-1 md:flex-1 md:flex-row md:items-baseline md:gap-4">
        <h1 class="leading-tight">
          <NuxtLink
            to="/"
            :aria-label="t('series.common.backHome')"
            class="font-title inline-flex items-center text-lg font-semibold leading-tight text-highlighted outline-none transition-colors hover:text-primary focus-visible:shadow-[var(--ring-focus)] md:text-xl"
          >
            {{ title }}
          </NuxtLink>
        </h1>
        <div class="flex flex-wrap items-center justify-center gap-1 text-muted md:justify-start">
          <UButton
            v-for="link in socialLinks"
            :key="link.label"
            :href="link.url"
            target="_blank"
            rel="noopener noreferrer"
            variant="ghost"
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
        <UThemeToggle />
        <LanguageSwitcher />
      </div>
    </div>
  </header>
  <div
    v-else
    class="border-b border-border bg-default"
  >
    <div class="mx-auto flex flex-wrap items-center justify-end gap-2 px-3 py-2 md:max-w-500 md:flex-nowrap md:gap-3 md:px-4 md:py-3">
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
      <UThemeToggle />
      <LanguageSwitcher />
    </div>
  </div>
</template>
