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
  <!--
    The public header is the admin header's sibling: one compact 48px row,
    no inner rules — brand on the left, social links beside it, utilities
    grouped on the right. Every control is ghosted so nothing competes
    with the photographs below.
  -->
  <header v-if="showHeaderInfo" class="wire-bar sticky top-0 z-30 border-b border-border">
    <div class="flex h-12 items-center gap-2 px-2 sm:px-3">
      <h1 class="flex min-w-0 max-w-[60vw] shrink-0 lg:max-w-none">
        <NuxtLink
          to="/"
          :aria-label="t('series.common.backHome')"
          class="flex min-w-0 items-center gap-2 rounded-md px-2 py-1 text-[14px] font-semibold tracking-[-0.01em] text-highlighted outline-none focus-visible:shadow-[var(--ring-focus)]"
        >
          <Icon name="jannchie:aperture" class="h-[18px] w-[18px] shrink-0" />
          <span class="truncate">{{ title }}</span>
        </NuxtLink>
      </h1>

      <div class="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto [scrollbar-width:none]">
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
          class="shrink-0"
          :icon="link.icon"
          :aria-label="link.label"
          :title="link.label"
        />
      </div>

      <div class="flex shrink-0 items-center gap-1">
        <UButton
          to="/map"
          color="neutral"
          variant="ghost"
          size="sm"
          icon="jannchie:map-pin"
          class="shrink-0"
          :aria-label="t('mapView.title')"
        >
          <span class="max-sm:hidden">{{ t('mapView.title') }}</span>
        </UButton>
        <UButton
          v-if="isAuthenticated"
          to="/admin"
          color="neutral"
          variant="ghost"
          size="sm"
          icon="jannchie:shield-check"
          class="shrink-0"
          :aria-label="t('admin.nav.label')"
        >
          <span class="max-sm:hidden">{{ t('admin.nav.label') }}</span>
        </UButton>
        <UThemeToggle />
        <LanguageSwitcher />
      </div>
    </div>
  </header>
  <!--
    Site info lives in the waterfall instead: the bar keeps only the
    utilities, right-aligned.
  -->
  <div v-else class="flex h-10 items-center justify-end gap-1 border-b border-border px-2 sm:px-3">
    <UButton
      to="/map"
      color="neutral"
      variant="ghost"
      size="sm"
      icon="jannchie:map-pin"
      class="shrink-0"
      :aria-label="t('mapView.title')"
    >
      <span class="max-sm:hidden">{{ t('mapView.title') }}</span>
    </UButton>
    <UButton
      v-if="isAuthenticated"
      to="/admin"
      color="neutral"
      variant="ghost"
      size="sm"
      icon="jannchie:shield-check"
      class="shrink-0"
      :aria-label="t('admin.nav.label')"
    >
      <span class="max-sm:hidden">{{ t('admin.nav.label') }}</span>
    </UButton>
    <UThemeToggle />
    <LanguageSwitcher />
  </div>
</template>
