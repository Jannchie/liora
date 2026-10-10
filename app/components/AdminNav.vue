<script setup lang="ts">
/*
 * Admin header — the icons site's grid header. One 56px row (plus its
 * hairline) of cells that share edges: the brand cell is exactly as wide
 * as the sidebar, so its right rule runs straight down into the
 * sidebar's; the breadcrumb takes the middle; the utilities sit in their
 * own cells on the right, each opened by a left rule.
 *
 * Below `lg` the sidebar is gone, so a second 44px row carries the
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
    <div class="grid h-14 grid-cols-[auto_minmax(0,1fr)_auto] lg:grid-cols-[220px_minmax(0,1fr)_auto]">
      <NuxtLink
        to="/admin"
        class="flex items-center gap-2.5 whitespace-nowrap border-r border-border px-4 font-semibold tracking-[-0.01em] text-highlighted outline-none sm:px-5"
      >
        <Icon name="jannchie:aperture" class="h-5 w-5 shrink-0" />
        <span class="max-sm:hidden">Liora</span>
        <span class="font-mono text-xs font-normal text-dimmed max-sm:hidden">v{{ version }}</span>
      </NuxtLink>

      <div class="flex min-w-0 items-center gap-2 px-4 font-mono text-[12.5px] sm:px-5">
        <span class="shrink-0 uppercase tracking-[0.06em] text-dimmed">{{ t('admin.nav.label') }}</span>
        <template v-if="current">
          <span class="text-subtle">/</span>
          <span class="truncate text-highlighted">{{ current.label }}</span>
        </template>
      </div>

      <div class="flex items-stretch">
        <div class="flex items-center border-l border-border px-2 sm:px-3">
          <UThemeToggle />
        </div>
        <div class="hidden items-center border-l border-border px-3 sm:flex">
          <LanguageSwitcher />
        </div>
        <div class="flex items-center border-l border-border px-2 sm:px-3">
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
    </div>

    <nav
      class="flex h-11 items-center gap-0.5 overflow-x-auto border-t border-border px-2 [scrollbar-width:none] lg:hidden"
      :aria-label="t('admin.nav.label')"
    >
      <NuxtLink
        v-for="item in items"
        :key="item.to"
        :to="item.to"
        class="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[13px] outline-none transition-colors focus-visible:shadow-[var(--ring-focus)]"
        :class="isActive(item.to) ? 'chip-raised' : 'text-muted hover:text-fg-highlighted'"
        :aria-current="isActive(item.to) ? 'page' : undefined"
      >
        <Icon :name="item.icon" class="h-4 w-4" />
        <span>{{ item.label }}</span>
      </NuxtLink>
    </nav>
  </header>
</template>
