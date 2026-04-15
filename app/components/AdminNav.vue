<script setup lang="ts">
import { computed, ref } from 'vue'

interface NavItem {
  label: string
  to: string
  icon: string
  value: string
}

const { t } = useI18n()

const route = useRoute()
const toast = useToast()
const loggingOut = ref(false)

const navItems = computed<NavItem[]>(() => [
  { label: t('admin.nav.upload'), to: '/admin/upload', icon: 'tabler:upload', value: '/admin/upload' },
  { label: t('admin.nav.files'), to: '/admin/files', icon: 'tabler:list', value: '/admin/files' },
  { label: t('admin.nav.series'), to: '/admin/series', icon: 'tabler:stack-3', value: '/admin/series' },
  { label: t('admin.nav.site'), to: '/admin/site', icon: 'tabler:globe', value: '/admin/site' },
])

const activeTab = computed<string>(() => navItems.value.find(item => item.to === route.path)?.value ?? '')

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

async function handleTabChange(value: string | number): Promise<void> {
  if (typeof value !== 'string' || value === route.path) {
    return
  }
  await navigateTo(value)
}
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-default/25 bg-default/90 py-2 text-sm text-default backdrop-blur sm:py-3">
    <div class="flex min-w-0 flex-1 items-center">
      <UTabs
        :items="navItems"
        :model-value="activeTab"
        :content="false"
        @update:model-value="handleTabChange"
      >
        <template #leading="{ item }">
          <Icon :name="item.icon" class="h-4 w-4" />
        </template>
      </UTabs>
    </div>
    <div class="flex shrink-0 items-center gap-1.5">
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
        variant="soft"
        color="primary"
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
</template>
