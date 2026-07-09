<script setup lang="ts">
import type { DepthMapViewerExpose } from '~/components/DepthMapViewer.vue'
import type { FileResponse } from '~/types/file'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const { t } = useI18n()
const route = useRoute()

useSeoMeta({
  title: () => t('demoDepth.title'),
  description: () => t('demoDepth.description'),
})

const viewerRef = ref<DepthMapViewerExpose | null>(null)
const originalUrl = ref('')
const depthUrl = ref('')
const statusMessage = ref('')
const isFetching = ref(false)
const imageWidth = ref<number | null>(null)
const imageHeight = ref<number | null>(null)
const directionDurationSeconds = ref(2)
const depthDurationSeconds = ref(2)
const maxBlur = ref(40)
const directionalDelay = ref(0.2)
const depthDelay = ref(0.3)
const depthEasePower = ref(0.5)
const directionMode = ref<'bottom-up' | 'top-down' | 'left-right' | 'right-left'>('bottom-up')
const invertDepth = ref(false)

const isViewerReady = computed(() => viewerRef.value?.isReady ?? false)
const isViewerLoading = computed(() => viewerRef.value?.isLoading ?? false)
const isViewerAnimating = computed(() => viewerRef.value?.isAnimating ?? false)
const isBusy = computed(() => isFetching.value || isViewerLoading.value)
const fileId = computed(() => {
  const raw = route.params.id
  const value = Array.isArray(raw) ? raw[0] : raw
  if (value === undefined) {
    return null
  }
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
})
const fileTitle = ref('')

let originalObjectUrl: string | null = null
let depthObjectUrl: string | null = null
let fileLoadToken = 0

function revokeObjectUrl(target: 'original' | 'depth'): void {
  if (target === 'original' && originalObjectUrl) {
    URL.revokeObjectURL(originalObjectUrl)
    originalObjectUrl = null
  }
  if (target === 'depth' && depthObjectUrl) {
    URL.revokeObjectURL(depthObjectUrl)
    depthObjectUrl = null
  }
}

function setOriginalSource(url: string, name: string, isObjectUrl: boolean): void {
  revokeObjectUrl('original')
  if (isObjectUrl) {
    originalObjectUrl = url
  }
  originalUrl.value = url
  statusMessage.value = ''
}

function setDepthSource(url: string, name: string, isObjectUrl: boolean): void {
  revokeObjectUrl('depth')
  if (isObjectUrl) {
    depthObjectUrl = url
  }
  depthUrl.value = url
  statusMessage.value = ''
}

async function loadFromFileId(id: number): Promise<void> {
  const token = ++fileLoadToken
  isFetching.value = true
  statusMessage.value = t('demoDepth.status.fetching')
  try {
    const file = await $fetch<FileResponse>(`/api/files/${id}`)
    if (token !== fileLoadToken) {
      return
    }
    fileTitle.value = file.title || file.originalName || `#${id}`
    imageWidth.value = file.width
    imageHeight.value = file.height
    setOriginalSource(file.imageUrl, file.originalName || file.title || '', false)
    const depthMap = file.metadata?.depthMapUrl?.trim() ?? ''
    if (!depthMap) {
      setDepthSource('', '', false)
      return
    }
    setDepthSource(depthMap, `depth-${id}.png`, false)
  }
  catch (error) {
    if (token !== fileLoadToken) {
      return
    }
    const message = error instanceof Error ? error.message : t('demoDepth.errors.fileNotFound')
    statusMessage.value = message
  }
  finally {
    if (token === fileLoadToken) {
      isFetching.value = false
    }
  }
}

function playAnimation(): void {
  viewerRef.value?.play()
}

onBeforeUnmount(() => {
  revokeObjectUrl('original')
  revokeObjectUrl('depth')
})

watch(
  () => route.params.id,
  () => {
    const raw = route.params.id
    const value = Array.isArray(raw) ? raw[0] : raw
    if (value !== undefined && fileId.value === null) {
      statusMessage.value = t('demoDepth.errors.invalidId')
      return
    }
    if (fileId.value) {
      void loadFromFileId(fileId.value)
    }
    else if (value === undefined) {
      fileTitle.value = ''
      imageWidth.value = null
      imageHeight.value = null
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="min-h-screen bg-default">
    <UContainer class="space-y-6 py-10">
      <header class="space-y-2">
        <h1 class="text-3xl font-semibold text-highlighted">
          {{ t('demoDepth.title') }}
        </h1>
        <p class="text-sm text-muted">
          {{ t('demoDepth.description') }}
        </p>
        <p v-if="fileId" class="text-sm text-muted">
          {{ t('demoDepth.fileLabel', { id: fileId, title: fileTitle || t('common.labels.untitled') }) }}
        </p>
      </header>

      <section class="space-y-4 rounded-xl bg-default/80 p-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="space-y-1">
            <p class="text-xs font-semibold uppercase tracking-wide text-muted">
              {{ t('demoDepth.viewer.title') }}
            </p>
            <p class="text-sm text-muted">
              {{ t('demoDepth.viewer.description') }}
            </p>
          </div>
          <UButton
            color="primary"
            :disabled="!isViewerReady || isBusy"
            :loading="isViewerAnimating"
            @click="playAnimation"
          >
            {{ t('demoDepth.actions.play') }}
          </UButton>
        </div>

        <DepthMapViewer
          ref="viewerRef"
          :image-url="originalUrl"
          :depth-url="depthUrl"
          :image-width="imageWidth ?? undefined"
          :image-height="imageHeight ?? undefined"
          :direction-duration-seconds="directionDurationSeconds"
          :depth-duration-seconds="depthDurationSeconds"
          :max-blur="maxBlur"
          :directional-delay="directionalDelay"
          :depth-delay="depthDelay"
          :depth-ease-power="depthEasePower"
          :direction-mode="directionMode"
          :invert-depth="invertDepth"
        />

        <div class="grid gap-4 sm:grid-cols-3">
          <label class="space-y-2 text-sm text-muted">
            <span class="font-medium text-highlighted">{{ t('demoDepth.controls.blur') }}</span>
            <input
              v-model.number="maxBlur"
              type="range"
              min="0"
              max="200"
              step="1"
              class="w-full"
            >
          </label>
          <label class="space-y-2 text-sm text-muted">
            <span class="font-medium text-highlighted">{{ t('demoDepth.controls.direction') }}</span>
            <input
              v-model.number="directionalDelay"
              type="range"
              min="0"
              max="0.6"
              step="0.02"
              class="w-full"
            >
          </label>
          <label class="space-y-2 text-sm text-muted">
            <span class="font-medium text-highlighted">{{ t('demoDepth.controls.depthDelay') }}</span>
            <input
              v-model.number="depthDelay"
              type="range"
              min="0"
              max="0.3"
              step="0.02"
              class="w-full"
            >
          </label>
          <label class="space-y-2 text-sm text-muted">
            <span class="font-medium text-highlighted">{{ t('demoDepth.controls.depthCurve') }}</span>
            <input
              v-model.number="depthEasePower"
              type="range"
              min="0.1"
              max="5"
              step="0.1"
              class="w-full"
            >
            <span class="text-xs text-muted">{{ depthEasePower.toFixed(1) }}</span>
          </label>
          <label class="space-y-2 text-sm text-muted">
            <span class="font-medium text-highlighted">{{ t('demoDepth.controls.directionMode') }}</span>
            <select
              v-model="directionMode"
              class="w-full rounded-lg border border-default/60 bg-default/60 px-3 py-2 text-sm"
            >
              <option value="bottom-up">{{ t('demoDepth.directionOptions.bottomUp') }}</option>
              <option value="top-down">{{ t('demoDepth.directionOptions.topDown') }}</option>
              <option value="left-right">{{ t('demoDepth.directionOptions.leftRight') }}</option>
              <option value="right-left">{{ t('demoDepth.directionOptions.rightLeft') }}</option>
            </select>
          </label>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <label class="space-y-2 text-sm text-muted">
            <span class="font-medium text-highlighted">{{ t('demoDepth.controls.directionDuration') }}</span>
            <input
              v-model.number="directionDurationSeconds"
              type="range"
              min="0.5"
              max="4"
              step="0.1"
              class="w-full"
            >
            <span class="text-xs text-muted">{{ directionDurationSeconds.toFixed(1) }}s</span>
          </label>
          <label class="space-y-2 text-sm text-muted">
            <span class="font-medium text-highlighted">{{ t('demoDepth.controls.depthDuration') }}</span>
            <input
              v-model.number="depthDurationSeconds"
              type="range"
              min="0.5"
              max="4"
              step="0.1"
              class="w-full"
            >
            <span class="text-xs text-muted">{{ depthDurationSeconds.toFixed(1) }}s</span>
          </label>
        </div>

        <label class="flex items-center gap-2 text-sm text-muted">
          <input v-model="invertDepth" type="checkbox" class="h-4 w-4">
          <span class="font-medium text-highlighted">{{ t('demoDepth.controls.invert') }}</span>
        </label>

        <p v-if="statusMessage" class="text-sm text-muted">
          {{ statusMessage }}
        </p>
      </section>
    </UContainer>
  </div>
</template>
