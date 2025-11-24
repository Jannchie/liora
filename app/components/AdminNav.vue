<script setup lang="ts">
import { ref } from 'vue'

interface NavItem {
  label: string
  to: string
  icon: string
}

const items: NavItem[] = [
  { label: '上传与列表', to: '/admin/upload', icon: 'mdi:database-outline' },
  { label: '站点信息', to: '/admin/site', icon: 'mdi:earth' },
]

const route = useRoute()
const toast = useToast()
const loggingOut = ref(false)

const isActive = (path: string): boolean => route.path === path

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
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-default/25 bg-default/90 px-4 py-3 text-sm text-default backdrop-blur">
    <div class="flex items-center gap-3">
      <div class="flex items-center gap-2 rounded-md bg-default/60 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted">
        <Icon name="mdi:shield-crown-outline" class="h-4 w-4" />
        <span>Admin</span>
      </div>
      <div class="flex flex-wrap items-center gap-1">
        <NuxtLink
          v-for="item in items"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-2 rounded-md px-3 py-1.5 text-muted ring-1 ring-transparent transition hover:bg-default/70 hover:text-default"
          :class="isActive(item.to) ? 'bg-primary-50 text-primary-700 ring-primary/30' : ''"
          :aria-current="isActive(item.to) ? 'page' : undefined"
        >
          <Icon :name="item.icon" class="h-4 w-4" />
          <span>{{ item.label }}</span>
        </NuxtLink>
      </div>
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
