<script setup lang="ts">
import type { SiteSettings, SiteSettingsPayload } from '~/types/site'
import { computed, reactive, ref, watch } from 'vue'

definePageMeta({
  middleware: 'admin-auth',
})

const toast = useToast()

const pageTitle = '站点信息 | Liora'
const pageDescription = '配置站点名称、描述与社交链接。'

useSeoMeta({
  title: pageTitle,
  ogTitle: pageTitle,
  description: pageDescription,
  ogDescription: pageDescription,
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
    return ''
  }
  const date = new Date(settingsData.value.updatedAt)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString()
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
    toast.add({ title: '已保存', description: '站点信息已更新。', color: 'primary' })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : '保存失败，请重试'
    toast.add({ title: '保存失败', description: message, color: 'error' })
  }
  finally {
    saving.value = false
  }
}

function handleReset(): void {
  applySettings(settingsData.value)
  toast.add({ title: '已重置', description: '已恢复为当前保存的站点信息。', color: 'neutral' })
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
            <span>站点信息</span>
          </p>
          <h1 class="flex items-center gap-2 text-3xl font-semibold text-highlighted">
            <Icon name="mdi:pencil-outline" class="h-6 w-6 text-primary-600" />
            <span>编辑站点</span>
          </h1>
          <p class="text-sm text-muted">
            配置首页展示的站点名称、描述以及社交链接。
          </p>
        </div>
        <div class="flex flex-col items-end gap-2 text-sm text-muted sm:items-end">
          <div class="flex items-center gap-2">
            <Icon name="mdi:clock-outline" class="h-4 w-4" />
            <span>上次更新：</span>
            <span class="text-highlighted">{{ lastUpdated || '尚无记录' }}</span>
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
                <span>保存</span>
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
                <span>重置</span>
              </span>
            </UButton>
          </div>
        </div>
      </header>

      <UAlert
        v-if="settingsError"
        color="error"
        variant="soft"
        title="加载站点信息失败"
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
                基本信息
              </p>
              <h2 class="text-xl font-semibold text-highlighted">
                站点标题与描述
              </h2>
            </div>
          </template>

          <div class="space-y-4">
            <div class="space-y-1.5">
              <div class="flex items-center gap-2 text-sm font-medium text-highlighted">
                <Icon name="mdi:format-title" class="h-4 w-4" />
                <span>站点名称</span>
              </div>
              <UInput
                v-model="form.name"
                placeholder="例如：Liora Gallery"
                :disabled="saving || loadingSettings"
              />
              <p class="text-xs text-muted">
                用于首页信息卡与浏览器标题，保持简短清晰。
              </p>
            </div>

            <div class="space-y-1.5">
              <div class="flex items-center gap-2 text-sm font-medium text-highlighted">
                <Icon name="mdi:text" class="h-4 w-4" />
                <span>站点描述</span>
              </div>
              <UTextarea
                v-model="form.description"
                :rows="4"
                placeholder="用于首页展示的简介，可留空"
                :disabled="saving || loadingSettings"
              />
              <p class="text-xs text-muted">
                简介会展示在瀑布流信息卡，建议 1-2 句说明站点定位，可留空。
              </p>
            </div>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-muted">
                  社交链接
                </p>
                <h2 class="text-xl font-semibold text-highlighted">
                  可选的社交平台
                </h2>
              </div>
              <span class="text-sm text-muted">留空则不会展示</span>
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
                placeholder="https://github.com/username"
                :disabled="saving || loadingSettings"
              />
              <p class="text-xs text-muted">
                需要完整链接（含 https://），留空则不显示。
              </p>
            </div>

            <div class="space-y-2 rounded border border-default/20 bg-default/60 p-3">
              <div class="flex items-center gap-2 text-sm font-medium text-highlighted">
                <Icon name="mdi:twitter" class="h-4 w-4" />
                <span>Twitter / X</span>
              </div>
              <UInput
                v-model="form.social.twitter"
                placeholder="https://twitter.com/username"
                :disabled="saving || loadingSettings"
              />
              <p class="text-xs text-muted">
                可填写 X 或 Twitter 链接，留空即隐藏。
              </p>
            </div>

            <div class="space-y-2 rounded border border-default/20 bg-default/60 p-3">
              <div class="flex items-center gap-2 text-sm font-medium text-highlighted">
                <Icon name="mdi:instagram" class="h-4 w-4" />
                <span>Instagram</span>
              </div>
              <UInput
                v-model="form.social.instagram"
                placeholder="https://instagram.com/username"
                :disabled="saving || loadingSettings"
              />
              <p class="text-xs text-muted">
                支持任何公开主页链接，未填则不展示。
              </p>
            </div>

            <div class="space-y-2 rounded border border-default/20 bg-default/60 p-3">
              <div class="flex items-center gap-2 text-sm font-medium text-highlighted">
                <Icon name="mdi:sina-weibo" class="h-4 w-4" />
                <span>微博</span>
              </div>
              <UInput
                v-model="form.social.weibo"
                placeholder="https://weibo.com/username"
                :disabled="saving || loadingSettings"
              />
              <p class="text-xs text-muted">
                需要可访问的完整链接，留空则隐藏。
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
            <span>重置</span>
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
            <span>保存站点信息</span>
          </span>
        </UButton>
      </div>
    </UContainer>
  </div>
</template>
