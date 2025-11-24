<script setup lang="ts">
import type { SessionState } from '~/types/auth'
import { reactive, ref } from 'vue'

const toast = useToast()
const pageTitle = '登录 | Liora 管理后台'
const pageDescription = '进入管理后台以维护作品与元数据。'

useSeoMeta({
  title: pageTitle,
  ogTitle: pageTitle,
  description: pageDescription,
  ogDescription: pageDescription,
  robots: 'noindex, nofollow',
})

const form = reactive({
  username: '',
  password: '',
})

const submitting = ref(false)
const errorMessage = ref('')

const { data: sessionState } = await useFetch<SessionState>('/api/auth/session', {
  default: () => ({ authenticated: false }),
})

if (sessionState.value?.authenticated) {
  await navigateTo('/admin')
}

async function handleSubmit(): Promise<void> {
  errorMessage.value = ''
  submitting.value = true
  try {
    await $fetch<SessionState>('/api/auth/login', {
      method: 'POST',
      body: { username: form.username, password: form.password },
    })
    toast.add({ title: '登录成功', color: 'primary' })
    await navigateTo('/admin')
  }
  catch (error) {
    const message = error instanceof Error ? error.message : '登录失败，请重试'
    errorMessage.value = message
    toast.add({ title: '登录失败', description: message, color: 'error' })
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-gray-50/50 px-4">
    <UCard class="w-full max-w-md">
      <template #header>
        <div class="space-y-1">
          <p class="text-sm text-gray-500">
            管理后台
          </p>
          <h1 class="text-2xl font-semibold">
            登录
          </h1>
          <p class="text-sm text-gray-500">
            使用配置的管理员账户进入后台。
          </p>
        </div>
      </template>

      <UForm class="space-y-4" @submit.prevent="handleSubmit">
        <UFormGroup label="用户名" name="username" required>
          <UInput
            v-model="form.username"
            autocomplete="username"
            placeholder="请输入用户名"
          />
        </UFormGroup>
        <UFormGroup label="密码" name="password" required>
          <UInput
            v-model="form.password"
            type="password"
            autocomplete="current-password"
            placeholder="请输入密码"
          />
        </UFormGroup>

        <UAlert
          v-if="errorMessage"
          color="error"
          variant="soft"
          title="登录失败"
          :description="errorMessage"
        />

        <UButton
          type="submit"
          color="primary"
          variant="solid"
          block
          :loading="submitting"
        >
          登录
        </UButton>
      </UForm>
    </UCard>
  </div>
</template>
