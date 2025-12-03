<script setup lang="ts">
import type { MediaFormState } from '~/types/admin'
import type { FileResponse } from '~/types/file'
import type { ImageAttrs, ResolvedFile } from '~/types/gallery'
import { thumbHashToDataURL } from 'thumbhash'
import { computed, ref } from 'vue'

const props = defineProps<{
  file: FileResponse | ResolvedFile | null
  loading?: boolean
  classifySource?: {
    file?: File | null
    imageUrl?: string | null
  }
}>()

const emit = defineEmits<{
  (event: 'submit'): void
  (event: 'close'): void
}>()

const open = defineModel<boolean>('open', { required: true })
const form = defineModel<MediaFormState>('form', { required: true })
const captureTimeLocal = defineModel<string>('captureTimeLocal', { required: true })
const replaceFile = defineModel<File | null>('replaceFile', { default: null })

const { t } = useI18n()
const toast = useToast()

function decodeThumbhash(value: string): Uint8Array | null {
  try {
    if (typeof atob === 'function') {
      return Uint8Array.from(atob(value), char => char.codePointAt(0) || 0)
    }
    if (typeof Buffer !== 'undefined') {
      return Uint8Array.from(Buffer.from(value, 'base64'))
    }
  }
  catch {
    return null
  }
  return null
}

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

  const src = (props.file.thumbnailUrl || props.file.imageUrl || '').trim()
  const width = props.file.width || undefined
  const height = props.file.height || undefined
  if (!src) {
    const thumbhash = props.file.metadata.thumbhash
    if (thumbhash) {
      const bytes = decodeThumbhash(thumbhash)
      if (bytes) {
        return {
          src: thumbHashToDataURL(bytes),
          width,
          height,
          srcset: '',
          sizes: undefined,
        }
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

const classifySource = computed(() => props.classifySource ?? { file: null, imageUrl: null })
const replacePreviewUrl = ref<string>('')
const replaceInput = ref<HTMLInputElement | null>(null)
const replaceFileName = computed(() => replaceFile.value?.name ?? '')
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
</script>

<template>
  <UModal
    v-model:open="open"
    fullscreen
    scrollable
    :ui="{ content: 'fixed inset-0 w-screen h-screen max-w-none max-h-none rounded-none p-0 sm:p-0 top-0! left-0! translate-x-0! translate-y-0! m-0!' }"
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
          <UButton variant="soft" color="neutral" icon="mdi:close" @click="handleClose">
            {{ t('common.actions.close') }}
          </UButton>
        </div>
        <div class="relative flex-1 overflow-y-auto">
          <UContainer class="px-5 py-4">
            <UForm :state="form" class="space-y-5 pb-16" @submit.prevent="handleSubmit">
              <div class="flex flex-col gap-5 lg:flex-row lg:items-start">
                <div
                  v-if="file && effectivePreviewAttrs"
                  class="w-full space-y-3 rounded-xl bg-elevated/70 p-3 lg:w-[420px] lg:shrink-0"
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
                        icon="mdi:camera-retake-outline"
                        @click="replaceInput?.click()"
                      >
                        {{ t('common.actions.changeImage') }}
                      </UButton>
                      <UButton
                        v-if="replaceFile"
                        variant="ghost"
                        color="neutral"
                        size="sm"
                        icon="mdi:close"
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

                <div class="flex-1">
                  <AdminMetadataForm
                    v-model:form="form"
                    v-model:capture-time-local="captureTimeLocal"
                    :classify-source="classifySource"
                  />
                </div>
              </div>

              <div class="sticky bottom-0 flex justify-end gap-2 bg-default/90 px-1 py-3 backdrop-blur">
                <UButton variant="soft" color="neutral" icon="mdi:arrow-left" @click="handleClose">
                  {{ t('common.actions.cancel') }}
                </UButton>
                <UButton
                  color="primary"
                  type="submit"
                  :loading="loading"
                  icon="mdi:content-save-outline"
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
