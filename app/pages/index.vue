<script setup lang="ts">
import type { SessionState } from '~/types/auth'
import type { FileResponse } from '~/types/file'
import type { SiteInfoPlacement, SocialLink } from '~/types/gallery'
import type { SiteSettings } from '~/types/site'
import { defineOgImageComponent } from '#imports'
import { computed, onMounted, ref } from 'vue'
import { useSiteSettingsState } from '~/composables/useSiteSettings'

const { t } = useI18n()

definePageMeta({
  alias: ['/photo/:id'],
})

const { data, pending, error } = await useFetch<FileResponse[]>('/api/files', {
  default: () => [],
})

const { settings: siteSettingsState, load: loadSiteSettings } = useSiteSettingsState()
await loadSiteSettings()

const siteSettings = computed<SiteSettings | null>(() => siteSettingsState.value)
const defaultTitle = computed(() => t('home.defaultTitle'))
const defaultDescription = computed(() => t('home.defaultDescription'))
const pageTitle = computed(() => {
  const name = siteSettings.value?.name?.trim()
  if (name && name.length > 0) {
    return name
  }
  return defaultTitle.value
})
const pageDescription = computed(() => {
  const description = siteSettings.value?.description?.trim()
  if (description && description.length > 0) {
    return description
  }
  return defaultDescription.value
})

const files = computed<FileResponse[]>(() => data.value ?? [])
const totalFiles = computed(() => files.value.length)
const isLoading = computed(() => pending.value)
const fetchError = computed(() => error.value)
const alertTitle = computed(() => fetchError.value?.message ?? t('home.fetchFailed'))
const alertDescription = computed(() => t('home.fetchFailedDescription'))
const emptyText = computed(() => t('home.emptyText'))
const loadingText = computed(() => t('home.loading'))
const scrollElementRef = ref<HTMLElement | undefined>()
const runtimeConfig = useRuntimeConfig()

const infoPlacement = computed<SiteInfoPlacement>(() => {
  const placement = siteSettings.value?.infoPlacement?.trim()
  return placement === 'header' ? 'header' : 'waterfall'
})

const showHeaderInfo = computed(() => infoPlacement.value === 'header')

const headerSocialLinks = computed<SocialLink[]>(() => {
  const links: SocialLink[] = []
  const social = siteSettings.value?.social ?? runtimeConfig.public.social

  const appendLink = (label: string, url: string | undefined, icon: string): void => {
    const normalized = (url ?? '').trim()
    if (normalized.length > 0) {
      links.push({ label, url: normalized, icon })
    }
  }

  appendLink('Homepage', social?.homepage, 'mdi:home')
  appendLink('GitHub', social?.github, 'mdi:github')
  appendLink('X', social?.twitter, 'fa6-brands:x-twitter')
  appendLink('Instagram', social?.instagram, 'mdi:instagram')
  appendLink('YouTube', social?.youtube, 'mdi:youtube')
  appendLink('TikTok', social?.tiktok, 'fa6-brands:tiktok')
  appendLink('Bilibili', social?.bilibili, 'simple-icons:bilibili')
  appendLink('LinkedIn', social?.linkedin, 'mdi:linkedin')
  appendLink('Weibo', social?.weibo, 'mdi:sina-weibo')
  return links
})

const { data: sessionState } = await useFetch<SessionState>('/api/auth/session', {
  default: () => ({ authenticated: false }),
})

const isAuthenticated = computed(() => sessionState.value?.authenticated ?? false)

onMounted(() => {
  const root = document.scrollingElement ?? document.documentElement ?? document.body ?? undefined
  if (root instanceof HTMLElement) {
    scrollElementRef.value = root
  }
})

usePageSeo({
  title: pageTitle,
  description: pageDescription,
})

defineOgImageComponent('LioraCard', {
  title: () => pageTitle.value,
  description: () => pageDescription.value,
  itemCount: () => totalFiles.value,
})
</script>

<template>
  <div class="home-display-font min-h-screen w-full">
    <header
      v-if="showHeaderInfo"
      class="sticky inset-x-0 top-0 z-30 w-full border-b border-default/20 bg-default"
    >
      <div class="mx-auto flex flex-wrap items-center justify-between gap-2 px-3 py-2 md:max-w-[2000px] md:gap-3 md:px-4 md:py-3">
        <div class="flex w-full flex-wrap items-center gap-2 md:flex-1 md:gap-3">
          <h1 class="home-title-font text-base font-semibold leading-tight text-highlighted md:text-lg">
            {{ pageTitle }}
          </h1>
          <div class="flex flex-wrap items-center gap-2 text-muted">
            <UButton
              v-for="link in headerSocialLinks"
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
        <div class="flex items-center gap-2 md:shrink-0">
          <UButton
            v-if="isAuthenticated"
            to="/admin"
            color="primary"
            variant="soft"
            size="sm"
            icon="mdi:shield-check-outline"
            class="shrink-0"
          >
            {{ t('admin.nav.label') }}
          </UButton>
          <LanguageSwitcher class="hidden md:block" />
        </div>
      </div>
    </header>
    <div class="max-w-[2000px] m-auto">
      <div
        v-if="!showHeaderInfo"
        class="mx-auto flex flex-wrap items-center justify-end gap-2 px-3 py-2 md:max-w-[2000px] md:flex-nowrap md:gap-3 md:px-4 md:py-3"
      >
        <UButton
          v-if="isAuthenticated"
          to="/admin"
          color="primary"
          variant="soft"
          size="sm"
          class="shrink-0"
          icon="mdi:shield-check-outline"
        >
          {{ t('admin.nav.label') }}
        </UButton>
        <LanguageSwitcher class="hidden md:block" />
      </div>
      <UAlert
        v-if="fetchError"
        color="error"
        variant="soft"
        :title="alertTitle"
        :description="alertDescription"
      >
        <template #icon>
          <Icon name="mdi:alert-circle-outline" class="h-5 w-5" />
        </template>
      </UAlert>

      <ClientOnly>
        <WaterfallGallery
          :files="files"
          :is-loading="isLoading"
          :site-settings="siteSettings ?? undefined"
          :scroll-element="scrollElementRef"
          :empty-text="emptyText"
          :is-authenticated="isAuthenticated"
        />
        <template #fallback>
          <div class="flex h-[50vh] items-center justify-center gap-2 text-sm text-muted">
            <Icon name="line-md:loading-loop" class="h-5 w-5 text-primary" />
            <span>{{ loadingText }}</span>
          </div>
        </template>
      </ClientOnly>
    </div>
  </div>
</template>
