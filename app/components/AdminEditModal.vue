<script setup lang="ts">
import type { MediaFormState } from '~/types/admin'
import type { FileResponse } from '~/types/file'
import type { ImageAttrs, ResolvedFile } from '~/types/gallery'
import type { SeriesSummary } from '~/types/series'
import { computed, onMounted, ref, watch } from 'vue'
import { arthashReady, decodeArthashToDataUrl, ensureArthashReady } from '~/utils/arthash'

const props = defineProps<{
  file: FileResponse | ResolvedFile | null
  loading?: boolean
  enableDepthAction?: boolean
  depthProcessing?: boolean
  classifySource?: {
    file?: File | null
    imageUrl?: string | null
  }
}>()

const emit = defineEmits<{
  (event: 'submit'): void
  (event: 'close'): void
  (event: 'generateDepth'): void
}>()

const open = defineModel<boolean>('open', { required: true })
const form = defineModel<MediaFormState>('form', { required: true })
const seriesIds = defineModel<number[]>('seriesIds', { default: () => [] })
const captureTimeLocal = defineModel<string>('captureTimeLocal', { required: true })
const replaceFile = defineModel<File | null>('replaceFile', { default: null })

const { t } = useI18n()
const toast = useToast()

const previewAttrs = computed<ImageAttrs | null>(() => {
  if (!props.file) {
    return null
  }
  if ('previewAttrs' in props.file && props.file.previewAttrs) {
    return props.file.previewAttrs
  }
  if ('imageAttrs' in props.file && props.file.imageAttrs) {
    return props.file.imageAttrs
  }

  const src = (props.file.imageUrl || '').trim()
  const width = props.file.width || undefined
  const height = props.file.height || undefined
  if (!src) {
    void arthashReady.value
    const placeholderSrc = decodeArthashToDataUrl(props.file.metadata.arthash)
    if (placeholderSrc) {
      return {
        src: placeholderSrc,
        width,
        height,
        srcset: '',
        sizes: undefined,
      }
    }
    return null
  }
  return {
    src,
    width,
    height,
    srcset: '',
    sizes: undefined,
  }
})

onMounted(() => {
  void ensureArthashReady()
})

const classifySource = computed(() => props.classifySource ?? { file: null, imageUrl: null })
const replacePreviewUrl = ref<string>('')
const replaceInput = ref<HTMLInputElement | null>(null)
const replaceFileName = computed(() => replaceFile.value?.name ?? '')
const { data: seriesOptionsData, pending: seriesOptionsPending, error: seriesOptionsError, refresh: refreshSeriesOptions } = useFetch<SeriesSummary[]>('/api/series', {
  default: () => [],
  server: false,
  immediate: false,
})
interface SeriesOptionItem {
  value: number
  label: string
  slug: string
  fileCount: number
}

const seriesOptionItems = computed<SeriesOptionItem[]>(() => {
  const options = seriesOptionsData.value ?? []
  return options
    .filter(item => !item.isVirtual)
    .map(item => ({
      value: item.id,
      label: item.title,
      slug: item.slug,
      fileCount: item.fileCount,
    }))
})
const fallbackSeriesItems = computed<SeriesOptionItem[]>(() => {
  const fileSeries = props.file?.series ?? []
  return fileSeries.map(item => ({
    value: item.id,
    label: item.title,
    slug: item.slug,
    fileCount: 0,
  }))
})
const seriesOptionMap = computed(() => {
  const map = new Map<number, SeriesOptionItem>()
  for (const item of fallbackSeriesItems.value) {
    map.set(item.value, item)
  }
  for (const item of seriesOptionItems.value) {
    map.set(item.value, item)
  }
  return map
})
const mergedSeriesOptionItems = computed<SeriesOptionItem[]>(() => {
  return [...seriesOptionMap.value.values()]
})
const selectedSeriesValues = computed<number[]>({
  get: () => seriesIds.value,
  set: (values) => {
    const normalized = values
      .map((value) => {
        if (typeof value === 'number') {
          return Number.isInteger(value) && value > 0 ? value : null
        }
        if (typeof value === 'string') {
          const parsed = Number.parseInt(value, 10)
          return Number.isInteger(parsed) && parsed > 0 ? parsed : null
        }
        return null
      })
      .filter((value): value is number => value !== null)
    seriesIds.value = [...new Set(normalized)]
  },
})
const seriesManageErrorMessage = computed(() => seriesOptionsError.value?.message ?? null)
const depthMapUrl = computed(() => {
  if (!props.file) {
    return ''
  }
  const raw = props.file.metadata?.depthMapUrl
  return typeof raw === 'string' ? raw.trim() : ''
})
const depthMapWidth = computed(() => {
  const raw = props.file?.metadata?.depthMapWidth
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : null
})
const depthMapHeight = computed(() => {
  const raw = props.file?.metadata?.depthMapHeight
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : null
})
const canGenerateDepth = computed(() => {
  const source = props.file?.imageUrl?.trim() ?? ''
  return source.length > 0
})
const effectivePreviewAttrs = computed<ImageAttrs | null>(() => {
  const baseAttrs = previewAttrs.value
  if (replacePreviewUrl.value) {
    return {
      src: replacePreviewUrl.value,
      width: form.value.width ?? baseAttrs?.width,
      height: form.value.height ?? baseAttrs?.height,
      srcset: baseAttrs?.srcset ?? '',
      sizes: baseAttrs?.sizes,
    }
  }
  return baseAttrs
})

function handleSubmit(): void {
  emit('submit')
}

function handleClose(): void {
  open.value = false
  clearReplaceSelection()
  emit('close')
}

function handleGenerateDepth(): void {
  if (!props.enableDepthAction || props.depthProcessing || !canGenerateDepth.value) {
    return
  }
  emit('generateDepth')
}

function handleRefreshSeriesOptions(): void {
  void refreshSeriesOptions()
}

function clearReplaceSelection(): void {
  if (replacePreviewUrl.value) {
    URL.revokeObjectURL(replacePreviewUrl.value)
  }
  replacePreviewUrl.value = ''
  replaceFile.value = null
}

async function detectReplaceSize(file: File): Promise<void> {
  const objectUrl = URL.createObjectURL(file)
  replacePreviewUrl.value = objectUrl
  try {
    const size = await new Promise<{ width: number, height: number }>((resolve, reject) => {
      const img = new Image()
      img.addEventListener('load', () => resolve({ width: img.naturalWidth, height: img.naturalHeight }))
      img.addEventListener('error', () => reject(new Error(t('admin.upload.toast.sizeReadError'))))
      img.src = objectUrl
    })
    form.value.width = size.width
    form.value.height = size.height
  }
  catch (error) {
    const message = error instanceof Error ? error.message : t('admin.upload.toast.sizeFailedFallback')
    toast.add({ title: t('admin.upload.toast.sizeFailed'), description: message, color: 'error' })
    clearReplaceSelection()
  }
}

async function handleReplaceChange(event: Event): Promise<void> {
  const target = event.target as HTMLInputElement | null
  const file = target?.files?.[0] ?? null
  if (!file) {
    clearReplaceSelection()
    return
  }
  clearReplaceSelection()
  replaceFile.value = file
  await detectReplaceSize(file)
}

watch(
  open,
  (isOpen) => {
    if (isOpen) {
      void refreshSeriesOptions()
    }
  },
)
</script>

<template>
  <UModal
    v-model:open="open"
    fullscreen
    scrollable
    :title="t('admin.files.editModal.fallbackTitle')"
    :description="file?.title || t('common.labels.untitled')"
    :ui="{
      overlay: 'z-[70]',
      wrapper: 'z-[71]',
      content: 'fixed inset-0 z-[72] w-screen h-screen max-w-none max-h-none rounded-none p-0 sm:p-0 top-0! left-0! translate-x-0! translate-y-0! m-0!',
    }"
  >
    <template #content>
      <div class="flex h-full flex-col bg-default/85 backdrop-blur">
        <div class="sticky top-0 z-10 flex items-start justify-between gap-3 bg-default/90 px-5 py-4 backdrop-blur">
          <div class="space-y-1">
            <p class="text-xs font-semibold uppercase tracking-wide text-muted">
              {{ t('common.actions.edit') }}
            </p>
            <h3 class="text-lg font-semibold text-highlighted">
              {{ file?.title || t('common.labels.untitled') }}
            </h3>
          </div>
          <UButton variant="soft" color="neutral" icon="tabler:x" @click="handleClose">
            {{ t('common.actions.close') }}
          </UButton>
        </div>
        <div class="relative flex-1 overflow-y-auto">
          <UContainer class="px-5 py-4">
            <UForm :state="form" class="space-y-5 pb-16" @submit.prevent="handleSubmit">
              <div class="flex flex-col gap-5 lg:flex-row lg:items-start">
                <div
                  v-if="file && effectivePreviewAttrs"
                  class="w-full space-y-3 rounded-xl p-3 lg:w-105 lg:shrink-0"
                >
                  <div class="flex items-center justify-between">
                    <p class="text-xs font-semibold uppercase tracking-wide text-muted">
                      {{ t('admin.files.table.headers.preview') }}
                    </p>
                    <div class="flex items-center gap-2">
                      <UButton
                        color="primary"
                        variant="soft"
                        size="sm"
                        icon="tabler:camera-rotate"
                        @click="replaceInput?.click()"
                      >
                        {{ t('common.actions.changeImage') }}
                      </UButton>
                      <UButton
                        v-if="enableDepthAction"
                        color="primary"
                        variant="soft"
                        size="sm"
                        icon="tabler:photo"
                        :loading="depthProcessing"
                        :disabled="depthProcessing || !canGenerateDepth"
                        @click="handleGenerateDepth"
                      >
                        {{ t('admin.files.actions.depth') }}
                      </UButton>
                      <UButton
                        v-if="replaceFile"
                        variant="ghost"
                        color="neutral"
                        size="sm"
                        icon="tabler:x"
                        :aria-label="t('common.actions.remove')"
                        @click="clearReplaceSelection"
                      />
                    </div>
                  </div>
                  <div class="flex items-center justify-center overflow-hidden rounded-lg bg-default/60">
                    <img
                      :key="replaceFile?.name || file.id"
                      :src="effectivePreviewAttrs.src || file.imageUrl"
                      :srcset="effectivePreviewAttrs.srcset"
                      :sizes="effectivePreviewAttrs.srcset ? effectivePreviewAttrs.sizes : undefined"
                      :alt="file.title || t('common.labels.untitled')"
                      :width="effectivePreviewAttrs.width || file.width"
                      :height="effectivePreviewAttrs.height || file.height"
                      loading="lazy"
                      class="h-auto max-h-[70vh] w-auto max-w-full object-contain"
                    >
                  </div>
                  <div v-if="depthMapUrl" class="space-y-2">
                    <p class="text-xs font-semibold uppercase tracking-wide text-muted">
                      {{ t('admin.files.depthMap.label') }}
                    </p>
                    <div class="flex items-center justify-center overflow-hidden rounded-lg bg-default/60">
                      <img
                        :src="depthMapUrl"
                        :alt="t('admin.files.depthMap.label')"
                        :width="depthMapWidth ?? undefined"
                        :height="depthMapHeight ?? undefined"
                        loading="lazy"
                        class="h-auto max-h-64 w-auto max-w-full object-contain"
                      >
                    </div>
                    <div v-if="depthMapWidth && depthMapHeight" class="text-xs text-muted">
                      <span class="rounded-full bg-default/70 px-2 py-0.5">
                        {{ depthMapWidth }} × {{ depthMapHeight }}
                      </span>
                    </div>
                  </div>
                  <div class="flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span class="font-semibold text-highlighted">
                      {{ replaceFileName || file.originalName || file.title || t('common.labels.untitled') }}
                    </span>
                    <span v-if="replaceFile" class="rounded-full bg-default/70 px-2 py-0.5">
                      {{ (replaceFile.size / 1024 / 1024).toFixed(2) }} MB
                    </span>
                    <span v-if="form.width && form.height" class="rounded-full bg-default/70 px-2 py-0.5">
                      {{ form.width }} × {{ form.height }}
                    </span>
                  </div>
                  <input
                    ref="replaceInput"
                    type="file"
                    accept="image/*"
                    class="hidden"
                    @change="handleReplaceChange"
                  >
                </div>

                <div class="flex-1 space-y-4">
                  <section class="space-y-4">
                    <div class="space-y-4">
                      <div class="flex items-start gap-2 rounded-lg bg-elevated/60 px-3 py-2">
                        <Icon name="tabler:stack-3" class="h-4 w-4 text-primary" />
                        <div>
                          <p class="text-xs font-semibold uppercase tracking-wide text-muted">
                            Series
                          </p>
                        </div>
                      </div>

                      <div class="flex w-full flex-col gap-4">
                        <UAlert
                          v-if="seriesManageErrorMessage"
                          color="error"
                          variant="soft"
                          :title="t('series.list.loadFailed')"
                          :description="seriesManageErrorMessage"
                        >
                          <template #actions>
                            <UButton
                              size="sm"
                              color="error"
                              variant="soft"
                              icon="tabler:refresh"
                              @click="handleRefreshSeriesOptions"
                            >
                              {{ t('common.actions.retry') }}
                            </UButton>
                          </template>
                        </UAlert>

                        <div class="space-y-3 rounded-xl border border-default/50 p-3">
                          <UInputMenu
                            v-model="selectedSeriesValues"
                            multiple
                            value-key="value"
                            label-key="label"
                            :items="mergedSeriesOptionItems"
                            :loading="seriesOptionsPending"
                            :filter-fields="['label', 'slug']"
                            :portal="false"
                            :placeholder="t('series.assign.searchPlaceholder')"
                            icon="tabler:search"
                            class="w-full"
                          >
                            <template #item-label="{ item }">
                              <div class="min-w-0">
                                <p class="truncate text-sm text-highlighted">
                                  {{ item.label }}
                                </p>
                                <p class="truncate text-xs text-muted">
                                  /{{ item.slug }} · {{ t('series.list.count', { count: item.fileCount }) }}
                                </p>
                              </div>
                            </template>
                          </UInputMenu>

                          <div
                            v-if="!seriesOptionsPending && seriesOptionItems.length === 0"
                            class="rounded-lg border border-default/40 bg-default/70 p-4 text-sm text-muted"
                          >
                            {{ t('series.assign.noSeries') }}
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>

                  <AdminMetadataForm
                    v-model:form="form"
                    v-model:capture-time-local="captureTimeLocal"
                    :classify-source="classifySource"
                  />
                </div>
              </div>

              <div class="sticky bottom-0 flex justify-end gap-2 bg-default/90 px-1 py-3 backdrop-blur">
                <UButton variant="soft" color="neutral" icon="tabler:arrow-left" @click="handleClose">
                  {{ t('common.actions.cancel') }}
                </UButton>
                <UButton
                  color="primary"
                  type="submit"
                  :loading="loading"
                  icon="tabler:device-floppy"
                >
                  {{ t('common.actions.save') }}
                </UButton>
              </div>
            </UForm>
          </UContainer>
        </div>
      </div>
    </template>
  </UModal>
</template>
