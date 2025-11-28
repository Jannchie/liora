<script setup lang="ts">
import type { SessionState } from '~/types/auth'
import { computed, reactive, ref } from 'vue'

const { t } = useI18n()
const toast = useToast()
const pageTitle = computed(() => t('admin.login.seoTitle'))
const pageDescription = computed(() => t('admin.login.seoDescription'))

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
  }
  catch (error) {
    const message = error instanceof Error ? error.message : t('admin.login.errorFallback')
    errorMessage.value = message
    toast.add({ title: t('admin.login.toastFailed'), description: message, color: 'error' })
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-muted/50 px-4">
    <UCard class="w-full max-w-md">
      <template #header>
        <div class="space-y-1">
          <p class="flex items-center gap-2 text-sm text-muted">
            <Icon name="mdi:shield-lock-outline" class="h-4 w-4" />
            <span>{{ t('admin.login.sectionLabel') }}</span>
          </p>
          <h1 class="flex items-center gap-2 text-2xl font-semibold">
            <Icon name="mdi:lock-open-check-outline" class="h-5 w-5 text-primary" />
            <span>{{ t('admin.login.heading') }}</span>
          </h1>
          <p class="text-sm text-muted">
            {{ t('admin.login.subtitle') }}
          </p>
        </div>
      </template>

      <UForm class="space-y-4" @submit.prevent="handleSubmit">
        <UFormGroup :label="t('admin.login.usernameLabel')" name="username" required>
          <UInput
            v-model="form.username"
            autocomplete="username"
            :placeholder="t('admin.login.usernamePlaceholder')"
          />
        </UFormGroup>
        <UFormGroup :label="t('admin.login.passwordLabel')" name="password" required>
          <UInput
            v-model="form.password"
            type="password"
            autocomplete="current-password"
            :placeholder="t('admin.login.passwordPlaceholder')"
          />
        </UFormGroup>

        <UAlert
          v-if="errorMessage"
          color="error"
          variant="soft"
          :title="t('admin.login.errorTitle')"
          :description="errorMessage"
        >
          <template #icon>
            <Icon name="mdi:alert-circle-outline" class="h-5 w-5" />
          </template>
        </UAlert>

        <UButton
          type="submit"
          color="primary"
          variant="solid"
          block
          :loading="submitting"
        >
          <div class="flex items-center justify-center gap-2">
            <Icon name="mdi:login" class="h-5 w-5" />
            <span>{{ t('admin.login.submit') }}</span>
          </div>
        </UButton>
      </UForm>
    </UCard>
  </div>
</template>
