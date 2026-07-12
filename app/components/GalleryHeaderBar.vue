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
    The header reads as a quiet museum wall label: one hairline strip, the
    site name a notch above caption weight, every control ghosted. Nothing
    here should compete with the photographs below it.
  -->
  <header
    v-if="showHeaderInfo"
    class="sticky inset-x-0 top-0 z-30 w-full border-b border-border-muted/60 bg-default/95 backdrop-blur-sm"
  >
    <div class="mx-auto flex w-full items-center justify-between gap-3 px-4 py-2.5 md:max-w-500">
      <div class="flex min-w-0 items-center gap-2.5">
        <h1 class="min-w-0 leading-none">
          <NuxtLink
            to="/"
            :aria-label="t('series.common.backHome')"
            class="inline-flex max-w-full items-center truncate text-sm font-medium leading-none text-highlighted outline-none transition-colors hover:text-primary focus-visible:shadow-[var(--ring-focus)]"
          >
            {{ title }}
          </NuxtLink>
        </h1>
        <div v-if="socialLinks.length > 0" class="flex shrink-0 items-center gap-0.5">
          <UButton
            v-for="link in socialLinks"
            :key="link.label"
            :href="link.url"
            target="_blank"
            rel="noopener noreferrer"
            variant="ghost"
            color="neutral"
            square
            size="xs"
            class="text-dimmed hover:text-muted"
            :icon="link.icon"
            :aria-label="link.label"
          />
        </div>
      </div>
      <div class="flex shrink-0 items-center gap-1">
        <UButton
          v-if="isAuthenticated"
          to="/admin"
          color="neutral"
          variant="ghost"
          size="sm"
          icon="tabler:shield-check"
          class="shrink-0 text-muted"
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
    class="border-b border-border-muted/60 bg-default"
  >
    <div class="mx-auto flex items-center justify-end gap-1 px-4 py-2 md:max-w-500">
      <UButton
        v-if="isAuthenticated"
        to="/admin"
        color="neutral"
        variant="ghost"
        size="sm"
        class="shrink-0 text-muted"
        icon="tabler:shield-check"
      >
        {{ t('admin.nav.label') }}
      </UButton>
      <UThemeToggle />
      <LanguageSwitcher />
    </div>
  </div>
</template>
