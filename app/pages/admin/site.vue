<script setup lang="ts">
import type { SiteSettings, SiteSettingsPayload } from '~/types/site'
import { computed, reactive, ref, watch } from 'vue'
import { useSiteSettingsState } from '~/composables/useSiteSettings'

const { t } = useI18n()
definePageMeta({
  middleware: 'admin-auth',
})

const toast = useToast()

const pageTitle = computed(() => t('admin.site.seoTitle'))
const pageDescription = computed(() => t('admin.site.seoDescription'))
const toastMessages = computed(() => ({
  saveFailed: t('admin.site.toast.saveFailed'),
  saveFailedFallback: t('admin.site.toast.saveFailedFallback'),
  loadFailed: t('admin.site.toast.loadFailed'),
  iconUploadFailed: t('admin.site.toast.iconUploadFailed'),
  iconUploadFailedFallback: t('admin.site.toast.iconUploadFailedFallback'),
}))

useSeoMeta({
  title: () => pageTitle.value,
  ogTitle: () => pageTitle.value,
  description: () => pageDescription.value,
  ogDescription: () => pageDescription.value,
  robots: 'noindex, nofollow',
})

const {
  settings: settingsState,
  loading: loadingSettingsState,
  error: settingsErrorState,
  load: loadSettings,
  setSettings,
} = useSiteSettingsState()

await loadSettings(true)

const loadingSettings = computed(() => loadingSettingsState.value)
const settingsError = computed(() => settingsErrorState.value)

const form = reactive<SiteSettingsPayload>({
  name: '',
  description: '',
  iconUrl: '',
  infoPlacement: 'header',
  customCss: '',
  social: {
    homepage: '',
    github: '',
    twitter: '',
    instagram: '',
    weibo: '',
    youtube: '',
    bilibili: '',
    tiktok: '',
    linkedin: '',
  },
})

const saving = ref(false)
const uploadingIcon = ref(false)
const iconFileInput = ref<HTMLInputElement | null>(null)

function applySettings(value: SiteSettings | null | undefined): void {
  if (!value) {
    return
  }
  form.name = value.name
  form.description = value.description
  form.iconUrl = value.iconUrl
  form.infoPlacement = value.infoPlacement ?? 'header'
  form.customCss = value.customCss ?? ''
  form.social.homepage = value.social.homepage
  form.social.github = value.social.github
  form.social.twitter = value.social.twitter
  form.social.instagram = value.social.instagram
  form.social.weibo = value.social.weibo
  form.social.youtube = value.social.youtube
  form.social.bilibili = value.social.bilibili
  form.social.tiktok = value.social.tiktok
  form.social.linkedin = value.social.linkedin
}

watch(settingsState, applySettings, { immediate: true })

const lastUpdated = computed(() => {
  if (!settingsState.value?.updatedAt) {
    return t('admin.site.lastUpdated.none')
  }
  const date = new Date(settingsState.value.updatedAt)
  return Number.isNaN(date.getTime()) ? t('admin.site.lastUpdated.none') : date.toLocaleString()
})

const resolvedIconPreview = computed(() => {
  const iconUrl = form.iconUrl?.trim() ?? ''
  if (iconUrl.length > 0) {
    return iconUrl
  }
  return '/favicon.ico'
})

const infoPlacementOptions = computed(() => ([
  { label: t('admin.site.fields.infoPlacement.header'), value: 'header' as const },
  { label: t('admin.site.fields.infoPlacement.waterfall'), value: 'waterfall' as const },
]))

async function handleSubmit(): Promise<void> {
  saving.value = true
  try {
    const updated = await $fetch<SiteSettings>('/api/site', {
      method: 'PUT',
      body: {
        name: form.name,
        description: form.description,
        iconUrl: form.iconUrl,
        infoPlacement: form.infoPlacement,
        customCss: form.customCss,
        social: { ...form.social },
      },
    })
    setSettings(updated)
  }
  catch (error) {
    const message = error instanceof Error ? error.message : toastMessages.value.saveFailedFallback
    toast.add({ title: toastMessages.value.saveFailed, description: message, color: 'error' })
  }
  finally {
    saving.value = false
  }
}

function openIconPicker(): void {
  iconFileInput.value?.click()
}

async function handleIconFileChange(event: Event): Promise<void> {
  if (uploadingIcon.value) {
    return
  }
  const target = event.target as HTMLInputElement | null
  const file = target?.files?.[0]
  if (!file) {
    return
  }
  if (target) {
    target.value = ''
  }
  uploadingIcon.value = true
  try {
    const formData = new FormData()
    formData.append('icon', file)
    const updated = await $fetch<SiteSettings>('/api/site/icon', {
      method: 'POST',
      body: formData,
    })
    applySettings(updated)
    setSettings(updated)
  }
  catch (error) {
    const message = error instanceof Error ? error.message : toastMessages.value.iconUploadFailedFallback
    toast.add({ title: toastMessages.value.iconUploadFailed, description: message, color: 'error' })
  }
  finally {
    uploadingIcon.value = false
  }
}

function handleReset(): void {
  applySettings(settingsState.value)
}
</script>

<template>
  <div class="min-h-screen">
    <UContainer class="space-y-8 py-10">
      <AdminNav />

      <header class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="flex items-center gap-2 text-3xl font-semibold text-highlighted">
            <Icon name="mdi:pencil-outline" class="h-6 w-6 text-primary" />
            <span>{{ t('admin.site.title') }}</span>
          </h1>
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
              icon="mdi:content-save-outline"
              @click="handleSubmit"
            >
              {{ t('common.actions.save') }}
            </UButton>
            <UButton
              variant="soft"
              color="neutral"
              :disabled="saving || loadingSettings"
              icon="mdi:restore"
              @click="handleReset"
            >
              {{ t('common.actions.reset') }}
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
              <h2 class="text-xl font-semibold text-highlighted">
                {{ t('admin.site.sections.basic.title') }}
              </h2>
            </div>
          </template>

          <div class="flex flex-wrap gap-4">
            <div class="flex min-w-65 flex-1 flex-col gap-1.5">
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

            <div class="flex min-w-55 flex-col gap-1.5">
              <div class="flex items-center gap-2 text-sm font-medium text-highlighted">
                <Icon name="mdi:view-dashboard-outline" class="h-4 w-4" />
                <span>{{ t('admin.site.fields.infoPlacement.label') }}</span>
              </div>
              <USelect
                v-model="form.infoPlacement"
                :items="infoPlacementOptions"
                :disabled="saving || loadingSettings"
              />
              <p class="text-xs text-muted">
                {{ t('admin.site.fields.infoPlacement.help') }}
              </p>
            </div>

            <div class="flex basis-full flex-col gap-1.5">
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

            <div class="flex basis-full flex-col gap-1.5">
              <div class="flex items-center gap-2 text-sm font-medium text-highlighted">
                <Icon name="mdi:code-tags" class="h-4 w-4" />
                <span>{{ t('admin.site.fields.customCss.label') }}</span>
              </div>
              <UTextarea
                v-model="form.customCss"
                :rows="8"
                :placeholder="t('admin.site.fields.customCss.placeholder')"
                :disabled="saving || loadingSettings"
                class="font-mono text-xs"
              />
              <p class="text-xs text-muted">
                {{ t('admin.site.fields.customCss.help') }}
              </p>
            </div>

            <div class="flex min-w-[320px] flex-1 flex-col gap-1.5">
              <div class="flex items-center gap-2 text-sm font-medium text-highlighted">
                <Icon name="mdi:link-variant" class="h-4 w-4" />
                <span>{{ t('admin.site.fields.icon.label') }}</span>
              </div>
              <UInput
                v-model="form.iconUrl"
                :placeholder="t('admin.site.fields.icon.placeholder')"
                :disabled="saving || loadingSettings"
              />
              <p class="text-xs text-muted">
                {{ t('admin.site.fields.icon.help') }}
              </p>
              <div class="flex flex-wrap items-center gap-3">
                <div class="flex items-center gap-2 rounded border border-default/20 bg-default/60 px-3 py-2">
                  <img
                    :src="resolvedIconPreview"
                    alt="Site icon preview"
                    class="h-10 w-10 rounded border border-default/20 bg-white object-contain"
                  >
                  <div class="text-xs text-muted">
                    <p class="font-semibold text-highlighted">
                      {{ t('admin.site.fields.icon.previewLabel') }}
                    </p>
                    <p>
                      {{ t('admin.site.fields.icon.previewHelp') }}
                    </p>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <UButton
                    color="primary"
                    variant="soft"
                    :loading="uploadingIcon"
                    :disabled="saving || loadingSettings || uploadingIcon"
                    icon="mdi:image-plus"
                    @click="openIconPicker"
                  >
                    {{ t('admin.site.fields.icon.upload') }}
                  </UButton>
                  <input
                    ref="iconFileInput"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/avif,image/svg+xml,image/x-icon,image/vnd.microsoft.icon"
                    class="hidden"
                    @change="handleIconFileChange"
                  >
                </div>
              </div>
              <p class="text-xs text-muted">
                {{ t('admin.site.fields.icon.uploadHelp') }}
              </p>
            </div>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <h2 class="text-xl font-semibold text-highlighted">
              {{ t('admin.site.sections.social.title') }}
            </h2>
          </template>

          <div class="flex flex-wrap gap-3">
            <div class="flex min-w-65 flex-[0_1_320px] flex-col gap-1.5 rounded border border-default/20 bg-default/60 p-3">
              <UInput
                v-model="form.social.homepage"
                :aria-label="t('admin.site.fields.homepage.placeholder')"
                :placeholder="t('admin.site.fields.homepage.placeholder')"
                :disabled="saving || loadingSettings"
              />
            </div>

            <div class="flex min-w-65 flex-[0_1_320px] flex-col gap-1.5 rounded border border-default/20 bg-default/60 p-3">
              <UInput
                v-model="form.social.github"
                aria-label="GitHub"
                :placeholder="t('admin.site.fields.github.placeholder')"
                :disabled="saving || loadingSettings"
              />
            </div>

            <div class="flex min-w-65 flex-[0_1_320px] flex-col gap-1.5 rounded border border-default/20 bg-default/60 p-3">
              <UInput
                v-model="form.social.twitter"
                aria-label="X"
                :placeholder="t('admin.site.fields.twitter.placeholder')"
                :disabled="saving || loadingSettings"
              />
            </div>

            <div class="flex min-w-65 flex-[0_1_320px] flex-col gap-1.5 rounded border border-default/20 bg-default/60 p-3">
              <UInput
                v-model="form.social.instagram"
                aria-label="Instagram"
                :placeholder="t('admin.site.fields.instagram.placeholder')"
                :disabled="saving || loadingSettings"
              />
            </div>

            <div class="flex min-w-65 flex-[0_1_320px] flex-col gap-1.5 rounded border border-default/20 bg-default/60 p-3">
              <UInput
                v-model="form.social.youtube"
                aria-label="YouTube"
                :placeholder="t('admin.site.fields.youtube.placeholder')"
                :disabled="saving || loadingSettings"
              />
            </div>

            <div class="flex min-w-65 flex-[0_1_320px] flex-col gap-1.5 rounded border border-default/20 bg-default/60 p-3">
              <UInput
                v-model="form.social.bilibili"
                aria-label="Bilibili"
                :placeholder="t('admin.site.fields.bilibili.placeholder')"
                :disabled="saving || loadingSettings"
              />
            </div>

            <div class="flex min-w-65 flex-[0_1_320px] flex-col gap-1.5 rounded border border-default/20 bg-default/60 p-3">
              <UInput
                v-model="form.social.tiktok"
                aria-label="TikTok"
                :placeholder="t('admin.site.fields.tiktok.placeholder')"
                :disabled="saving || loadingSettings"
              />
            </div>

            <div class="flex min-w-65 flex-[0_1_320px] flex-col gap-1.5 rounded border border-default/20 bg-default/60 p-3">
              <UInput
                v-model="form.social.linkedin"
                aria-label="LinkedIn"
                :placeholder="t('admin.site.fields.linkedin.placeholder')"
                :disabled="saving || loadingSettings"
              />
            </div>

            <div class="flex min-w-65 flex-[0_1_320px] flex-col gap-1.5 rounded border border-default/20 bg-default/60 p-3">
              <UInput
                v-model="form.social.weibo"
                :aria-label="t('admin.site.fields.weibo.placeholder')"
                :placeholder="t('admin.site.fields.weibo.placeholder')"
                :disabled="saving || loadingSettings"
              />
            </div>
          </div>
        </UCard>
      </div>

      <div class="flex items-center justify-end gap-2">
        <UButton
          variant="soft"
          color="neutral"
          :disabled="saving || loadingSettings"
          icon="mdi:restore"
          @click="handleReset"
        >
          {{ t('common.actions.reset') }}
        </UButton>
        <UButton
          color="primary"
          :loading="saving"
          :disabled="saving || loadingSettings"
          icon="mdi:content-save-outline"
          @click="handleSubmit"
        >
          {{ t('admin.site.actions.save') }}
        </UButton>
      </div>
    </UContainer>
  </div>
</template>
