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
  { label: t('admin.nav.upload'), to: '/admin/upload', icon: 'mdi:upload-outline', value: '/admin/upload' },
  { label: t('admin.nav.files'), to: '/admin/files', icon: 'mdi:view-list-outline', value: '/admin/files' },
  { label: t('admin.nav.site'), to: '/admin/site', icon: 'mdi:earth', value: '/admin/site' },
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
  <div class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-default/25 bg-default/90 py-3 text-sm text-default backdrop-blur">
    <div class="flex items-center gap-3">
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
    <div class="flex items-center gap-2">
      <LanguageSwitcher />
      <UButton to="/" variant="soft" color="primary">
        <span class="flex items-center gap-2">
          <Icon name="mdi:home-outline" class="h-4 w-4" />
          <span>{{ t('admin.nav.viewFrontend') }}</span>
        </span>
      </UButton>
      <UButton
        variant="soft"
        color="primary"
        :loading="loggingOut"
        @click="handleLogout"
      >
        <span class="flex items-center gap-2">
          <Icon name="mdi:logout" class="h-4 w-4" />
          <span>{{ t('admin.nav.logout') }}</span>
        </span>
      </UButton>
    </div>
  </div>
</template>
