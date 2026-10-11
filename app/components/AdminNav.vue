<script setup lang="ts">
/*
 * Admin header — one compact 48px row (plus its hairline), no inner
 * rules: brand, breadcrumb, then the utilities grouped on the right. On
 * `lg` the brand slot is as wide as the sidebar, so the breadcrumb starts
 * on the content column's edge.
 *
 * Below `lg` the sidebar is gone, so a second 40px row carries the
 * destinations as a scrolling strip of pressed-state buttons.
 */
import { ref } from 'vue'
import { version } from '~~/package.json'

const { t } = useI18n()
const toast = useToast()
const { items, isActive, current } = useAdminNavItems()
const loggingOut = ref(false)

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
  <header class="wire-bar sticky top-0 z-30 border-b border-border">
    <div class="grid h-12 grid-cols-[auto_minmax(0,1fr)_auto] items-center lg:grid-cols-[220px_minmax(0,1fr)_auto]">
      <NuxtLink
        to="/admin"
        class="flex h-full items-center gap-2 whitespace-nowrap px-4 text-[14px] font-semibold tracking-[-0.01em] text-highlighted outline-none sm:px-5"
      >
        <Icon name="jannchie:aperture" class="h-[18px] w-[18px] shrink-0" />
        <!-- Name and version share a baseline; the pair is then centred on
             the icon with the rest of the row. -->
        <span class="flex items-baseline gap-2 max-sm:hidden">
          <span>Liora</span>
          <span class="font-mono text-[11px] font-normal text-dimmed">v{{ version }}</span>
        </span>
      </NuxtLink>

      <div class="flex min-w-0 items-center gap-2 px-2 font-mono text-xs sm:px-5">
        <span class="shrink-0 uppercase tracking-[0.06em] text-dimmed">{{ t('admin.nav.label') }}</span>
        <template v-if="current">
          <span class="text-subtle">/</span>
          <span class="truncate text-highlighted">{{ current.label }}</span>
        </template>
      </div>

      <div class="flex items-center gap-1 px-2 sm:px-3">
        <UThemeToggle />
        <LanguageSwitcher class="max-sm:hidden" />
        <UButton
          variant="ghost"
          color="neutral"
          :loading="loggingOut"
          icon="jannchie:logout"
          size="sm"
          :square="true"
          :aria-label="t('admin.nav.logout')"
          :title="t('admin.nav.logout')"
          @click="handleLogout"
        />
      </div>
    </div>

    <nav
      class="flex h-10 items-center gap-0.5 overflow-x-auto border-t border-border px-2 [scrollbar-width:none] lg:hidden"
      :aria-label="t('admin.nav.label')"
    >
      <NuxtLink
        v-for="item in items"
        :key="item.to"
        :to="item.to"
        class="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[13px] outline-none transition-colors focus-visible:shadow-[var(--ring-focus)]"
        :class="isActive(item.to) ? 'chip-raised' : 'text-muted hover:text-fg-highlighted'"
        :aria-current="isActive(item.to) ? 'page' : undefined"
      >
        <Icon :name="item.icon" class="h-4 w-4" />
        <span>{{ item.label }}</span>
      </NuxtLink>
    </nav>
  </header>
</template>
