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
  <div class="flex min-h-screen items-center justify-center bg-muted/60 px-4 py-10">
    <UCard
      class="w-full max-w-md border border-default/60 bg-default shadow-none"
    >
      <div class="space-y-6">
        <div class="space-y-2 text-center">
          <div class="mx-auto inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Icon name="mdi:shield-lock-outline" class="h-4 w-4" />
            <span>{{ t('admin.login.sectionLabel') }}</span>
          </div>
          <h1 class="text-2xl font-semibold">
            {{ t('admin.login.heading') }}
          </h1>
          <p class="text-sm text-muted">
            {{ pageDescription }}
          </p>
        </div>

        <UForm class="flex flex-col gap-4" @submit.prevent="handleSubmit">
          <div class="flex flex-col gap-2">
            <label :for="usernameId" class="text-sm font-medium text-foreground">
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
            <label :for="passwordId" class="text-sm font-medium text-foreground">
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
      </div>
    </UCard>
  </div>
</template>
