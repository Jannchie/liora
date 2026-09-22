<script setup lang="ts">
/*
 * Admin top bar — one unbroken strip of chrome, no frame.
 *
 * Why no border:
 *   A rule under the bar plus the side rails on the container drew a box
 *   around every admin page; the chrome ended up louder than the content
 *   it framed. The bar now separates from the page by *rhythm* alone —
 *   it sits above the page header with its own breathing room.
 *
 * Nav items form a single segmented control: one sunken track holding
 * all destinations, the active one lifted out of it with the page fill.
 * That reads as one object you move through, rather than five buttons
 * that happen to sit next to each other.
 */
import { computed, ref } from 'vue'

interface NavItem {
  label: string
  to: string
  icon: string
}

const { t } = useI18n()

const route = useRoute()
const toast = useToast()
const loggingOut = ref(false)

const navItems = computed<NavItem[]>(() => [
  { label: t('admin.nav.upload'), to: '/admin/upload', icon: 'tabler:upload' },
  { label: t('admin.nav.files'), to: '/admin/files', icon: 'tabler:list' },
  { label: t('admin.nav.series'), to: '/admin/series', icon: 'tabler:stack-3' },
  { label: t('admin.nav.backfill'), to: '/admin/backfill', icon: 'tabler:tools' },
  { label: t('admin.nav.site'), to: '/admin/site', icon: 'tabler:globe' },
])

const activePath = computed(() => route.path)
const isActive = (to: string): boolean => activePath.value === to || activePath.value.startsWith(`${to}/`)

async function handleLogout(): Promise<void> {
  loggingOut.value = true
  try {
    await $fetch('/api/auth/logout', { method: 'POST' })
    await navigateTo('/admin/login')
  }
  catch (error) {
    const message = error instanceof Error ? error.message : t('admin.nav.logoutFailed')
    toast.add({ title: t('admin.nav.logoutFailed'), description: message, color: 'error' })
  }
  finally {
    loggingOut.value = false
  }
}
</script>

<template>
  <header class="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 pt-2">
    <!-- left: brand eyebrow + segmented nav -->
    <nav class="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2" :aria-label="t('admin.nav.label')">
      <p class="label-caption flex shrink-0 items-center gap-1.5 text-foreground">
        <Icon name="tabler:shield-check" class="h-3.5 w-3.5" />
        <span>{{ t('admin.nav.label') }}</span>
      </p>
      <div class="surface-sunken flex flex-wrap items-center gap-0.5 p-1">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:shadow-[var(--ring-focus)]"
          :class="isActive(item.to)
            ? 'chip-raised'
            : 'text-muted hover:text-fg'"
          :aria-current="isActive(item.to) ? 'page' : undefined"
        >
          <Icon :name="item.icon" class="h-4 w-4" />
          <span>{{ item.label }}</span>
        </NuxtLink>
      </div>
    </nav>

    <!-- right: utility cluster -->
    <div class="flex shrink-0 items-center gap-1">
      <UThemeToggle />
      <LanguageSwitcher class="hidden sm:block" />
      <UButton
        to="/"
        variant="ghost"
        color="neutral"
        icon="tabler:home"
        size="sm"
        square
        class="sm:hidden"
        :aria-label="t('admin.nav.viewFrontend')"
      />
      <UButton
        to="/"
        variant="ghost"
        color="neutral"
        icon="tabler:home"
        size="sm"
        class="hidden sm:inline-flex"
      >
        {{ t('admin.nav.viewFrontend') }}
      </UButton>
      <UButton
        variant="ghost"
        color="neutral"
        :loading="loggingOut"
        icon="tabler:logout"
        size="sm"
        square
        class="sm:hidden"
        :aria-label="t('admin.nav.logout')"
        @click="handleLogout"
      />
      <UButton
        variant="ghost"
        color="neutral"
        :loading="loggingOut"
        icon="tabler:logout"
        size="sm"
        class="hidden sm:inline-flex"
        @click="handleLogout"
      >
        {{ t('admin.nav.logout') }}
      </UButton>
    </div>
  </header>
</template>
