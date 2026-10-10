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
    The public header is the admin header's sibling: one 56px row of
    cells sharing edges inside the shell. The brand cell is ruled on its
    right, social links take the middle, and each utility sits in its own
    cell opened by a left hairline. Every control is ghosted so nothing
    competes with the photographs below.
  -->
  <header
    v-if="showHeaderInfo"
    class="wire-bar sticky top-0 z-30 border-b border-border"
  >
    <div class="grid h-14 grid-cols-[auto_minmax(0,1fr)_auto]">
      <h1 class="flex min-w-0 max-w-[60vw] border-r border-border lg:min-w-[220px] lg:max-w-none">
        <NuxtLink
          to="/"
          :aria-label="t('series.common.backHome')"
          class="flex min-w-0 items-center gap-2.5 px-4 text-[14px] font-semibold tracking-[-0.01em] text-highlighted outline-none focus-visible:shadow-[var(--ring-focus)] sm:px-5"
        >
          <Icon name="jannchie:aperture" class="h-5 w-5 shrink-0" />
          <span class="truncate">{{ title }}</span>
        </NuxtLink>
      </h1>

      <div class="flex min-w-0 items-center gap-0.5 overflow-x-auto px-2 [scrollbar-width:none] sm:px-3">
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

      <div class="flex items-stretch">
        <div v-if="isAuthenticated" class="flex items-center border-l border-border px-2 sm:px-3">
          <UButton
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
        </div>
        <div class="flex items-center border-l border-border px-2 sm:px-3">
          <UThemeToggle />
        </div>
        <div class="flex items-center border-l border-border px-2 sm:px-3">
          <LanguageSwitcher />
        </div>
      </div>
    </div>
  </header>
  <!--
    Site info lives in the waterfall instead: the bar keeps only the
    utility cells, right-aligned, on the same hairline grid.
  -->
  <div
    v-else
    class="flex h-11 items-stretch justify-end border-b border-border"
  >
    <div v-if="isAuthenticated" class="flex items-center border-l border-border px-2 sm:px-3">
      <UButton
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
    </div>
    <div class="flex items-center border-l border-border px-2 sm:px-3">
      <UThemeToggle />
    </div>
    <div class="flex items-center border-l border-border px-2 sm:px-3">
      <LanguageSwitcher />
    </div>
  </div>
</template>
