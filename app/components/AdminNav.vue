<script setup lang="ts">
/*
 * Admin top bar — full-bleed within the container rails, multi-button nav,
 * utility cluster on the right.
 *
 * Why a header bar (not inline tabs):
 *   AdminNav previously rendered an underline-tab inside the content stack,
 *   which left a heavy block of empty space above and below it and competed
 *   visually with USection's own divider. A dedicated bar pinned to the top
 *   of the container, separated by a single hairline, reads as page chrome
 *   instead of "section one."
 *
 * Layout notes:
 *   - Negative margins break out of UContainer's px / pt so the bar's
 *     border-b lands flush with the rails on the left/right and at the
 *     viewport top.
 *   - Nav items are rendered as buttons (UButton). The active one uses the
 *     subtle/primary fill; inactive items are ghost. No underline.
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
  <header
    class="-mx-4 -mt-10 border-b border-border sm:-mx-6 lg:-mx-8"
  >
    <div class="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-4 sm:px-6 lg:px-8">
      <!-- left: brand eyebrow + multi-button nav -->
      <nav class="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2" :aria-label="t('admin.nav.label')">
        <p class="label-mono flex shrink-0 items-center gap-1.5 text-foreground">
          <Icon name="tabler:shield-check" class="h-3.5 w-3.5" />
          <span>{{ t('admin.nav.label') }}</span>
        </p>
        <div class="flex flex-wrap items-center gap-1.5">
          <UButton
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            size="sm"
            :icon="item.icon"
            :variant="isActive(item.to) ? 'soft' : 'ghost'"
            :color="isActive(item.to) ? 'primary' : 'neutral'"
            :aria-current="isActive(item.to) ? 'page' : undefined"
          >
            {{ item.label }}
          </UButton>
        </div>
      </nav>

      <!-- right: utility cluster -->
      <div class="flex shrink-0 items-center gap-1.5">
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
          variant="soft"
          color="primary"
          :loading="loggingOut"
          icon="tabler:logout"
          size="sm"
          class="hidden sm:inline-flex"
          @click="handleLogout"
        >
          {{ t('admin.nav.logout') }}
        </UButton>
      </div>
    </div>
  </header>
</template>
