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

void loadSettings(true)

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
            <Icon name="tabler:pencil" class="h-6 w-6 text-primary" />
            <span>{{ t('admin.site.title') }}</span>
          </h1>
        </div>
        <div class="flex flex-col items-end gap-2 text-sm text-muted sm:items-end">
          <div class="flex items-center gap-2">
            <Icon name="tabler:clock" class="h-4 w-4" />
            <span>{{ t('admin.site.lastUpdated.label') }}</span>
            <span class="text-highlighted">{{ lastUpdated }}</span>
          </div>
          <div class="flex gap-2">
            <UButton
              color="primary"
              :loading="saving"
              :disabled="saving || loadingSettings"
              icon="tabler:device-floppy"
              @click="handleSubmit"
            >
              {{ t('common.actions.save') }}
            </UButton>
            <UButton
              variant="soft"
              color="neutral"
              :disabled="saving || loadingSettings"
              icon="tabler:restore"
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
          <Icon name="tabler:alert-circle" class="h-5 w-5" />
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

          <div class="space-y-4">
            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField :label="t('admin.site.fields.name.label')" :description="t('admin.site.fields.name.help')">
                <UInput
                  v-model="form.name"
                  :placeholder="t('admin.site.fields.name.placeholder')"
                  :disabled="saving || loadingSettings"
                  icon="tabler:heading"
                />
              </UFormField>

              <UFormField :label="t('admin.site.fields.infoPlacement.label')" :description="t('admin.site.fields.infoPlacement.help')">
                <USelect
                  v-model="form.infoPlacement"
                  :items="infoPlacementOptions"
                  :disabled="saving || loadingSettings"
                />
              </UFormField>
            </div>

            <UFormField :label="t('admin.site.fields.description.label')" :description="t('admin.site.fields.description.help')">
              <UTextarea
                v-model="form.description"
                :rows="4"
                :placeholder="t('admin.site.fields.description.placeholder')"
                :disabled="saving || loadingSettings"
              />
            </UFormField>

            <UFormField :label="t('admin.site.fields.icon.label')" :description="t('admin.site.fields.icon.help')">
              <UInput
                v-model="form.iconUrl"
                :placeholder="t('admin.site.fields.icon.placeholder')"
                :disabled="saving || loadingSettings"
                icon="tabler:link"
              />
              <template #hint>
                <div class="flex items-center gap-3">
                  <div class="flex items-center gap-2 rounded-lg border border-default/20 bg-default/60 px-3 py-2">
                    <img
                      :src="resolvedIconPreview"
                      alt="Site icon preview"
                      class="h-8 w-8 rounded border border-default/20 bg-white object-contain"
                    >
                    <span class="text-xs text-muted">{{ t('admin.site.fields.icon.previewLabel') }}</span>
                  </div>
                  <UButton
                    color="primary"
                    variant="soft"
                    size="sm"
                    :loading="uploadingIcon"
                    :disabled="saving || loadingSettings || uploadingIcon"
                    icon="tabler:photo-plus"
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
              </template>
            </UFormField>

            <UFormField :label="t('admin.site.fields.customCss.label')" :description="t('admin.site.fields.customCss.help')">
              <UTextarea
                v-model="form.customCss"
                :rows="8"
                :placeholder="t('admin.site.fields.customCss.placeholder')"
                :disabled="saving || loadingSettings"
                class="font-mono text-xs"
              />
            </UFormField>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <h2 class="text-xl font-semibold text-highlighted">
              {{ t('admin.site.sections.social.title') }}
            </h2>
          </template>

          <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <UFormField label="Homepage">
              <UInput
                v-model="form.social.homepage"
                :placeholder="t('admin.site.fields.homepage.placeholder')"
                :disabled="saving || loadingSettings"
                icon="tabler:home"
              />
            </UFormField>

            <UFormField label="GitHub">
              <UInput
                v-model="form.social.github"
                :placeholder="t('admin.site.fields.github.placeholder')"
                :disabled="saving || loadingSettings"
                icon="tabler:brand-github"
              />
            </UFormField>

            <UFormField label="X (Twitter)">
              <UInput
                v-model="form.social.twitter"
                :placeholder="t('admin.site.fields.twitter.placeholder')"
                :disabled="saving || loadingSettings"
                icon="tabler:brand-x"
              />
            </UFormField>

            <UFormField label="Instagram">
              <UInput
                v-model="form.social.instagram"
                :placeholder="t('admin.site.fields.instagram.placeholder')"
                :disabled="saving || loadingSettings"
                icon="tabler:brand-instagram"
              />
            </UFormField>

            <UFormField label="YouTube">
              <UInput
                v-model="form.social.youtube"
                :placeholder="t('admin.site.fields.youtube.placeholder')"
                :disabled="saving || loadingSettings"
                icon="tabler:brand-youtube"
              />
            </UFormField>

            <UFormField label="Bilibili">
              <UInput
                v-model="form.social.bilibili"
                :placeholder="t('admin.site.fields.bilibili.placeholder')"
                :disabled="saving || loadingSettings"
                icon="tabler:brand-bilibili"
              />
            </UFormField>

            <UFormField label="TikTok">
              <UInput
                v-model="form.social.tiktok"
                :placeholder="t('admin.site.fields.tiktok.placeholder')"
                :disabled="saving || loadingSettings"
                icon="tabler:brand-tiktok"
              />
            </UFormField>

            <UFormField label="LinkedIn">
              <UInput
                v-model="form.social.linkedin"
                :placeholder="t('admin.site.fields.linkedin.placeholder')"
                :disabled="saving || loadingSettings"
                icon="tabler:brand-linkedin"
              />
            </UFormField>

            <UFormField label="Weibo">
              <UInput
                v-model="form.social.weibo"
                :placeholder="t('admin.site.fields.weibo.placeholder')"
                :disabled="saving || loadingSettings"
                icon="tabler:brand-weibo"
              />
            </UFormField>
          </div>
        </UCard>
      </div>

      <div class="flex items-center justify-end gap-2">
        <UButton
          variant="soft"
          color="neutral"
          :disabled="saving || loadingSettings"
          icon="tabler:restore"
          @click="handleReset"
        >
          {{ t('common.actions.reset') }}
        </UButton>
        <UButton
          color="primary"
          :loading="saving"
          :disabled="saving || loadingSettings"
          icon="tabler:device-floppy"
          @click="handleSubmit"
        >
          {{ t('admin.site.actions.save') }}
        </UButton>
      </div>
    </UContainer>
  </div>
</template>
