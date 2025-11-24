<script setup lang="ts">
import type { SiteSettings, SiteSettingsPayload } from '~/types/site'
import { computed, reactive, ref, watch } from 'vue'

const { t } = useI18n()
definePageMeta({
  middleware: 'admin-auth',
})

const toast = useToast()

const pageTitle = computed(() => t('admin.site.seoTitle'))
const pageDescription = computed(() => t('admin.site.seoDescription'))
const toastMessages = computed(() => ({
  saveSuccess: t('admin.site.toast.saveSuccess'),
  saveSuccessDescription: t('admin.site.toast.saveSuccessDescription'),
  saveFailed: t('admin.site.toast.saveFailed'),
  saveFailedFallback: t('admin.site.toast.saveFailedFallback'),
  reset: t('admin.site.toast.reset'),
  resetDescription: t('admin.site.toast.resetDescription'),
  loadFailed: t('admin.site.toast.loadFailed'),
}))

useSeoMeta({
  title: () => pageTitle.value,
  ogTitle: () => pageTitle.value,
  description: () => pageDescription.value,
  ogDescription: () => pageDescription.value,
  robots: 'noindex, nofollow',
})

const { data: settingsData, pending: loadingSettings, error: settingsError } = await useFetch<SiteSettings>('/api/site', {
  default: () => ({
    name: 'Liora Gallery',
    description: 'A minimal gallery for photography and illustrations.',
    social: { github: '', twitter: '', instagram: '', weibo: '' },
    updatedAt: new Date().toISOString(),
  }),
})

const form = reactive<SiteSettingsPayload>({
  name: '',
  description: '',
  social: {
    github: '',
    twitter: '',
    instagram: '',
    weibo: '',
  },
})

const saving = ref(false)

function applySettings(value: SiteSettings | null | undefined): void {
  if (!value) {
    return
  }
  form.name = value.name
  form.description = value.description
  form.social.github = value.social.github
  form.social.twitter = value.social.twitter
  form.social.instagram = value.social.instagram
  form.social.weibo = value.social.weibo
}

watch(settingsData, applySettings, { immediate: true })

const lastUpdated = computed(() => {
  if (!settingsData.value?.updatedAt) {
    return t('admin.site.lastUpdated.none')
  }
  const date = new Date(settingsData.value.updatedAt)
  return Number.isNaN(date.getTime()) ? t('admin.site.lastUpdated.none') : date.toLocaleString()
})

async function handleSubmit(): Promise<void> {
  saving.value = true
  try {
    const updated = await $fetch<SiteSettings>('/api/site', {
      method: 'PUT',
      body: {
        name: form.name,
        description: form.description,
        social: { ...form.social },
      },
    })
    settingsData.value = updated
    toast.add({ title: toastMessages.value.saveSuccess, description: toastMessages.value.saveSuccessDescription, color: 'primary' })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : toastMessages.value.saveFailedFallback
    toast.add({ title: toastMessages.value.saveFailed, description: message, color: 'error' })
  }
  finally {
    saving.value = false
  }
}

function handleReset(): void {
  applySettings(settingsData.value)
  toast.add({ title: toastMessages.value.reset, description: toastMessages.value.resetDescription, color: 'neutral' })
}
</script>

<template>
  <div class="min-h-screen">
    <UContainer class="space-y-8 py-10">
      <AdminNav />

      <header class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="flex items-center gap-2 text-sm text-muted">
            <Icon name="mdi:earth" class="h-4 w-4" />
            <span>{{ t('admin.site.badge') }}</span>
          </p>
          <h1 class="flex items-center gap-2 text-3xl font-semibold text-highlighted">
            <Icon name="mdi:pencil-outline" class="h-6 w-6 text-primary-600" />
            <span>{{ t('admin.site.title') }}</span>
          </h1>
          <p class="text-sm text-muted">
            {{ t('admin.site.subtitle') }}
          </p>
        </div>
        <div class="flex flex-col items-end gap-2 text-sm text-muted sm:items-end">
          <div class="flex items-center gap-2">
            <Icon name="mdi:clock-outline" class="h-4 w-4" />
            <span>{{ t('admin.site.lastUpdated.label') }}</span>
            <span class="text-highlighted">{{ lastUpdated }}</span>
          </div>
          <div class="flex gap-2">
            <UButton
              color="primary"
              :loading="saving"
              :disabled="saving || loadingSettings"
              @click="handleSubmit"
            >
              <span class="flex items-center gap-2">
                <Icon name="mdi:content-save-outline" class="h-4 w-4" />
                <span>{{ t('common.actions.save') }}</span>
              </span>
            </UButton>
            <UButton
              variant="ghost"
              color="neutral"
              :disabled="saving || loadingSettings"
              @click="handleReset"
            >
              <span class="flex items-center gap-2">
                <Icon name="mdi:restore" class="h-4 w-4" />
                <span>{{ t('common.actions.reset') }}</span>
              </span>
            </UButton>
          </div>
        </div>
      </header>

      <UAlert
        v-if="settingsError"
        color="error"
        variant="soft"
        :title="toastMessages.loadFailed"
        :description="settingsError?.message"
      >
        <template #icon>
          <Icon name="mdi:alert-circle-outline" class="h-5 w-5" />
        </template>
      </UAlert>

      <div class="space-y-6">
        <UCard>
          <template #header>
            <div class="flex flex-col gap-1">
              <p class="text-sm text-muted">
                {{ t('admin.site.sections.basic.label') }}
              </p>
              <h2 class="text-xl font-semibold text-highlighted">
                {{ t('admin.site.sections.basic.title') }}
              </h2>
            </div>
          </template>

          <div class="space-y-4">
            <div class="space-y-1.5">
              <div class="flex items-center gap-2 text-sm font-medium text-highlighted">
                <Icon name="mdi:format-title" class="h-4 w-4" />
                <span>{{ t('admin.site.fields.name.label') }}</span>
              </div>
              <UInput
                v-model="form.name"
                :placeholder="t('admin.site.fields.name.placeholder')"
                :disabled="saving || loadingSettings"
              />
              <p class="text-xs text-muted">
                {{ t('admin.site.fields.name.help') }}
              </p>
            </div>

            <div class="space-y-1.5">
              <div class="flex items-center gap-2 text-sm font-medium text-highlighted">
                <Icon name="mdi:text" class="h-4 w-4" />
                <span>{{ t('admin.site.fields.description.label') }}</span>
              </div>
              <UTextarea
                v-model="form.description"
                :rows="4"
                :placeholder="t('admin.site.fields.description.placeholder')"
                :disabled="saving || loadingSettings"
              />
              <p class="text-xs text-muted">
                {{ t('admin.site.fields.description.help') }}
              </p>
            </div>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-muted">
                  {{ t('admin.site.sections.social.label') }}
                </p>
                <h2 class="text-xl font-semibold text-highlighted">
                  {{ t('admin.site.sections.social.title') }}
                </h2>
              </div>
              <span class="text-sm text-muted">{{ t('admin.site.sections.social.helper') }}</span>
            </div>
          </template>

          <div class="space-y-3">
            <div class="space-y-2 rounded border border-default/20 bg-default/60 p-3">
              <div class="flex items-center gap-2 text-sm font-medium text-highlighted">
                <Icon name="mdi:github" class="h-4 w-4" />
                <span>GitHub</span>
              </div>
              <UInput
                v-model="form.social.github"
                :placeholder="t('admin.site.fields.github.placeholder')"
                :disabled="saving || loadingSettings"
              />
              <p class="text-xs text-muted">
                {{ t('admin.site.fields.github.help') }}
              </p>
            </div>

            <div class="space-y-2 rounded border border-default/20 bg-default/60 p-3">
              <div class="flex items-center gap-2 text-sm font-medium text-highlighted">
                <Icon name="mdi:twitter" class="h-4 w-4" />
                <span>Twitter / X</span>
              </div>
              <UInput
                v-model="form.social.twitter"
                :placeholder="t('admin.site.fields.twitter.placeholder')"
                :disabled="saving || loadingSettings"
              />
              <p class="text-xs text-muted">
                {{ t('admin.site.fields.twitter.help') }}
              </p>
            </div>

            <div class="space-y-2 rounded border border-default/20 bg-default/60 p-3">
              <div class="flex items-center gap-2 text-sm font-medium text-highlighted">
                <Icon name="mdi:instagram" class="h-4 w-4" />
                <span>Instagram</span>
              </div>
              <UInput
                v-model="form.social.instagram"
                :placeholder="t('admin.site.fields.instagram.placeholder')"
                :disabled="saving || loadingSettings"
              />
              <p class="text-xs text-muted">
                {{ t('admin.site.fields.instagram.help') }}
              </p>
            </div>

            <div class="space-y-2 rounded border border-default/20 bg-default/60 p-3">
              <div class="flex items-center gap-2 text-sm font-medium text-highlighted">
                <Icon name="mdi:sina-weibo" class="h-4 w-4" />
                <span>{{ t('admin.site.fields.weibo.label') }}</span>
              </div>
              <UInput
                v-model="form.social.weibo"
                :placeholder="t('admin.site.fields.weibo.placeholder')"
                :disabled="saving || loadingSettings"
              />
              <p class="text-xs text-muted">
                {{ t('admin.site.fields.weibo.help') }}
              </p>
            </div>
          </div>
        </UCard>
      </div>

      <div class="flex items-center justify-end gap-2">
        <UButton
          variant="ghost"
          color="neutral"
          :disabled="saving || loadingSettings"
          @click="handleReset"
        >
          <span class="flex items-center gap-2">
            <Icon name="mdi:restore" class="h-4 w-4" />
            <span>{{ t('common.actions.reset') }}</span>
          </span>
        </UButton>
        <UButton
          color="primary"
          :loading="saving"
          :disabled="saving || loadingSettings"
          @click="handleSubmit"
        >
          <span class="flex items-center gap-2">
            <Icon name="mdi:content-save-outline" class="h-4 w-4" />
            <span>{{ t('admin.site.actions.save') }}</span>
          </span>
        </UButton>
      </div>
    </UContainer>
  </div>
</template>
