<script setup lang="ts">
import type { SessionState } from '~/types/auth'
import { computed, reactive, ref } from 'vue'

const { t } = useI18n()
const toast = useToast()
const pageTitle = computed(() => t('admin.login.seoTitle'))
const pageDescription = computed(() => t('admin.login.seoDescription'))
const usernameId = 'admin-login-username'
const passwordId = 'admin-login-password'

useSeoMeta({
  title: () => pageTitle.value,
  ogTitle: () => pageTitle.value,
  description: () => pageDescription.value,
  ogDescription: () => pageDescription.value,
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
    await navigateTo('/admin')
  } catch (error) {
    const message = error instanceof Error ? error.message : t('admin.login.errorFallback')
    errorMessage.value = message
    toast.add({ title: t('admin.login.toastFailed'), description: message, color: 'error' })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
    <div class="w-full max-w-sm overflow-hidden rounded-[10px] border border-border bg-default">
      <div class="flex h-14 items-center gap-2.5 border-b border-border px-5">
        <Icon name="jannchie:aperture" class="h-5 w-5 shrink-0 text-highlighted" />
        <span class="font-semibold tracking-[-0.01em] text-highlighted">Liora</span>
        <span class="label-caption ml-auto flex items-center gap-1.5">
          <Icon name="jannchie:shield-lock" class="h-3.5 w-3.5" />
          {{ t('admin.login.sectionLabel') }}
        </span>
      </div>
      <div class="space-y-6 px-5 py-6">
        <div class="space-y-1.5">
          <h1 class="text-xl font-semibold tracking-[-0.01em] text-highlighted">
            {{ t('admin.login.heading') }}
          </h1>
          <p class="text-[13px] text-dimmed">
            {{ pageDescription }}
          </p>
        </div>

        <UForm class="flex flex-col gap-4" @submit.prevent="handleSubmit">
          <div class="flex flex-col gap-2">
            <label :for="usernameId" class="label-caption">
              {{ t('admin.login.usernameLabel') }}
            </label>
            <UInput
              :id="usernameId"
              v-model="form.username"
              autocomplete="username"
              :placeholder="t('admin.login.usernamePlaceholder')"
            />
          </div>

          <div class="flex flex-col gap-2">
            <label :for="passwordId" class="label-caption">
              {{ t('admin.login.passwordLabel') }}
            </label>
            <UInput
              :id="passwordId"
              v-model="form.password"
              type="password"
              autocomplete="current-password"
              :placeholder="t('admin.login.passwordPlaceholder')"
            />
          </div>

          <UAlert
            v-if="errorMessage"
            color="error"
            variant="soft"
            :title="t('admin.login.errorTitle')"
            :description="errorMessage"
          >
            <template #icon>
              <Icon name="jannchie:alert-circle" class="h-5 w-5" />
            </template>
          </UAlert>

          <UButton type="submit" color="primary" variant="solid" block :loading="submitting" icon="jannchie:login">
            {{ t('admin.login.submit') }}
          </UButton>
        </UForm>
      </div>
    </div>
  </div>
</template>
