<script setup lang="ts">
import { computed, ref } from 'vue'

interface NavItem {
  label: string
  to: string
  icon: string
  value: string
}

const items: NavItem[] = [
  { label: '上传', to: '/admin/upload', icon: 'mdi:upload-outline', value: '/admin/upload' },
  { label: '数据列表', to: '/admin/files', icon: 'mdi:view-list-outline', value: '/admin/files' },
  { label: '站点信息', to: '/admin/site', icon: 'mdi:earth', value: '/admin/site' },
]

const route = useRoute()
const toast = useToast()
const loggingOut = ref(false)

const activeTab = computed<string>(() => items.find((item) => item.to === route.path)?.value ?? '')

async function handleLogout(): Promise<void> {
  loggingOut.value = true
  try {
    await $fetch('/api/auth/logout', { method: 'POST' })
    toast.add({ title: '已退出登录', color: 'primary' })
    await navigateTo('/admin/login')
  }
  catch (error) {
    const message = error instanceof Error ? error.message : '退出失败，请重试'
    toast.add({ title: '退出失败', description: message, color: 'error' })
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
  <div class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-default/25 bg-default/90 px-4 py-3 text-sm text-default backdrop-blur">
    <div class="flex items-center gap-3">
      <div class="flex items-center gap-2 rounded-md bg-default/60 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted">
        <Icon name="mdi:shield-crown-outline" class="h-4 w-4" />
        <span>Admin</span>
      </div>
      <UTabs
        :items="items"
        :model-value="activeTab"
        :content="false"
        :ui="{
          list: 'flex flex-wrap items-center gap-1 p-0',
          indicator: 'hidden',
          trigger: 'flex items-center gap-2 rounded-md px-3 py-1.5 text-muted ring-1 ring-transparent transition hover:bg-default/70 hover:text-default data-[state=active]:bg-primary-50 data-[state=active]:text-primary-700 data-[state=active]:ring-primary/30',
        }"
        @update:model-value="handleTabChange"
      >
        <template #leading="{ item }">
          <Icon :name="item.icon" class="h-4 w-4" />
        </template>
      </UTabs>
    </div>
    <div class="flex items-center gap-2">
      <UButton to="/" variant="ghost" color="primary">
        <span class="flex items-center gap-2">
          <Icon name="mdi:home-outline" class="h-4 w-4" />
          <span>查看前台</span>
        </span>
      </UButton>
      <UButton
        variant="ghost"
        color="primary"
        :loading="loggingOut"
        @click="handleLogout"
      >
        <span class="flex items-center gap-2">
          <Icon name="mdi:logout" class="h-4 w-4" />
          <span>退出</span>
        </span>
      </UButton>
    </div>
  </div>
</template>
