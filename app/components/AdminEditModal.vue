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
  (event: 'recomposed', value: FileResponse): void
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

const recomposeOpen = ref(false)

function handleRecomposeSaved(updated: FileResponse): void {
  emit('recomposed', updated)
}

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
      overlay: 'z-70',
      wrapper: 'z-71',
      content: 'fixed inset-0 z-72 w-screen h-screen max-w-none max-h-none rounded-none p-0 sm:p-0 top-0! left-0! translate-x-0! translate-y-0! m-0!',
    }"
  >
    <template #content>
      <!--
        Full-screen editor in the app's wireframe: frosted header and
        footer bars closed by hairlines, and between them a centred shell
        split into a preview pane and a metadata pane by a single rule.
      -->
      <div class="flex h-full flex-col bg-bg">
        <header class="wire-bar sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-8">
          <div class="min-w-0 space-y-0.5">
            <p class="label-caption">
              {{ t('common.actions.edit') }}<template v-if="file">
                · <span class="num-tabular">#{{ file.id }}</span>
              </template>
            </p>
            <h3 class="truncate text-[15px] font-semibold tracking-[-0.01em] text-highlighted">
              {{ file?.title || t('common.labels.untitled') }}
            </h3>
          </div>
          <UButton variant="ghost" color="neutral" icon="jannchie:x" square :aria-label="t('common.actions.close')" @click="handleClose" />
        </header>
        <div class="relative flex-1 overflow-y-auto">
          <UForm
            :state="form"
            class="mx-auto flex w-full max-w-[1680px] flex-col bg-default lg:flex-row lg:items-stretch min-[1682px]:border-x min-[1682px]:border-border"
            @submit.prevent="handleSubmit"
          >
            <!-- PREVIEW PANE -->
            <aside
              v-if="file && effectivePreviewAttrs"
              class="w-full border-b border-border lg:w-112 lg:shrink-0 lg:border-r lg:border-b-0"
            >
              <div class="flex min-h-12 flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2 sm:px-6">
                <p class="label-caption">
                  {{ t('admin.files.table.headers.preview') }}
                </p>
                <div class="flex flex-wrap items-center gap-0.5">
                  <UButton
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    icon="jannchie:camera-rotate"
                    @click="replaceInput?.click()"
                  >
                    {{ t('common.actions.changeImage') }}
                  </UButton>
                  <UButton
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    icon="jannchie:crop"
                    :disabled="Boolean(replaceFile)"
                    @click="recomposeOpen = true"
                  >
                    {{ t('admin.files.recompose.open') }}
                  </UButton>
                  <UButton
                    v-if="enableDepthAction"
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    icon="jannchie:image"
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
                    icon="jannchie:x"
                    square
                    :aria-label="t('common.actions.remove')"
                    @click="clearReplaceSelection"
                  />
                </div>
              </div>
              <!-- The photo fills the pane edge to edge on a sunken well. -->
              <div class="flex items-center justify-center border-b border-border bg-muted">
                <!-- With an authored framing (and no pending replacement), preview the framed composition. -->
                <div
                  v-if="file.metadata.recompose && !replacePreviewUrl"
                  class="relative w-full"
                  :style="{ aspectRatio: `${file.width} / ${file.height}` }"
                >
                  <RecomposeFrame :params="file.metadata.recompose">
                    <img
                      :key="file.id"
                      :src="effectivePreviewAttrs.src || file.imageUrl"
                      :srcset="effectivePreviewAttrs.srcset"
                      :sizes="effectivePreviewAttrs.srcset ? effectivePreviewAttrs.sizes : undefined"
                      :alt="file.title || t('common.labels.untitled')"
                      loading="lazy"
                      class="h-full w-full"
                    >
                  </RecomposeFrame>
                </div>
                <img
                  v-else
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
              <dl class="num-tabular flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border px-4 py-3 text-xs sm:px-6">
                <dd class="min-w-0 truncate font-mono text-highlighted">
                  {{ replaceFileName || file.originalName || file.title || t('common.labels.untitled') }}
                </dd>
                <dd v-if="replaceFile" class="text-dimmed">
                  {{ (replaceFile.size / 1024 / 1024).toFixed(2) }} MB
                </dd>
                <dd v-if="form.width && form.height" class="text-dimmed">
                  {{ form.width }} × {{ form.height }}
                </dd>
              </dl>
              <div v-if="depthMapUrl" class="border-b border-border">
                <div class="flex min-h-11 items-center justify-between gap-2 border-b border-border px-4 py-2 sm:px-6">
                  <p class="label-caption">
                    {{ t('admin.files.depthMap.label') }}
                  </p>
                  <p v-if="depthMapWidth && depthMapHeight" class="num-tabular text-xs text-dimmed">
                    {{ depthMapWidth }} × {{ depthMapHeight }}
                  </p>
                </div>
                <div class="flex items-center justify-center bg-muted">
                  <img
                    :src="depthMapUrl"
                    :alt="t('admin.files.depthMap.label')"
                    :width="depthMapWidth ?? undefined"
                    :height="depthMapHeight ?? undefined"
                    loading="lazy"
                    class="h-auto max-h-64 w-auto max-w-full object-contain"
                  >
                </div>
              </div>
              <input
                ref="replaceInput"
                type="file"
                accept="image/*"
                class="hidden"
                @change="handleReplaceChange"
              >
            </aside>

            <!-- METADATA PANE -->
            <div class="min-w-0 flex-1">
              <div class="border-b border-border px-4 py-6 sm:px-8">
                <USection label="Series" icon="jannchie:layers">
                  <div class="space-y-3">
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
                          variant="ghost"
                          icon="jannchie:refresh"
                          @click="handleRefreshSeriesOptions"
                        >
                          {{ t('common.actions.retry') }}
                        </UButton>
                      </template>
                    </UAlert>

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
                      icon="jannchie:search"
                      class="w-full"
                    >
                      <template #item-label="{ item }">
                        <div class="min-w-0">
                          <p class="truncate text-[13px] text-highlighted">
                            {{ item.label }}
                          </p>
                          <p class="truncate text-[11px] text-dimmed">
                            <span class="font-mono">/{{ item.slug }}</span> · <span class="num-tabular">{{ t('series.list.count', { count: item.fileCount }) }}</span>
                          </p>
                        </div>
                      </template>
                    </UInputMenu>

                    <p
                      v-if="!seriesOptionsPending && seriesOptionItems.length === 0"
                      class="text-xs text-dimmed"
                    >
                      {{ t('series.assign.noSeries') }}
                    </p>
                  </div>
                </USection>
              </div>

              <!--
                The form's groups are divided by hairlines; giving each
                group the pane's gutter (instead of padding the pane) lets
                those rules run across the whole pane.
              -->
              <AdminMetadataForm
                v-model:capture-time-local="captureTimeLocal"
                :form="form"
                :classify-source="classifySource"
                class="py-6 *:px-4 sm:*:px-8"
              />
            </div>
          </UForm>
          <footer class="wire-bar sticky bottom-0 z-10 flex justify-end gap-2 border-t border-border px-4 py-3 sm:px-8">
            <UButton variant="ghost" color="neutral" @click="handleClose">
              {{ t('common.actions.cancel') }}
            </UButton>
            <UButton
              color="primary"
              type="button"
              :loading="loading"
              icon="jannchie:save"
              @click="handleSubmit"
            >
              {{ t('common.actions.save') }}
            </UButton>
          </footer>
        </div>
      </div>
      <AdminRecomposeEditorModal
        v-model:open="recomposeOpen"
        :file="file"
        @saved="handleRecomposeSaved"
      />
    </template>
  </UModal>
</template>
