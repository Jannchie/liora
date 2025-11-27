<script setup lang="ts">
import type { MediaFormState } from '~/types/admin'
import type { FileResponse, ImageAttrs } from '~/types/file'
import type { ResolvedFile } from '~/types/gallery'
import { thumbHashToDataURL } from 'thumbhash'
import { computed } from 'vue'

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

const { t } = useI18n()

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
  if (!src) {
    const thumbhash = props.file.metadata.thumbhash
    if (thumbhash) {
      const bytes = decodeThumbhash(thumbhash)
      if (bytes) {
        return {
          src: thumbHashToDataURL(bytes),
          width: props.file.width || undefined,
          height: props.file.height || undefined,
        }
      }
    }
    return null
  }
  return {
    src,
    width: props.file.width || undefined,
    height: props.file.height || undefined,
  }
})

const classifySource = computed(() => props.classifySource ?? { file: null, imageUrl: null })

function handleSubmit(): void {
  emit('submit')
}

function handleClose(): void {
  open.value = false
  emit('close')
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
          <UButton variant="soft" color="neutral" @click="handleClose">
            <span class="flex items-center gap-1.5">
              <Icon name="mdi:close" class="h-4 w-4" />
              <span>{{ t('common.actions.close') }}</span>
            </span>
          </UButton>
        </div>
        <div class="relative flex-1 overflow-y-auto">
          <UContainer class="px-5 py-4">
            <UForm :state="form" class="space-y-5 pb-16" @submit.prevent="handleSubmit">
              <div class="flex flex-col gap-5 lg:flex-row lg:items-start">
                <div
                  v-if="file && previewAttrs"
                  class="w-full space-y-2 rounded-xl bg-elevated/70 p-3 lg:w-[420px] lg:flex-shrink-0"
                >
                  <p class="text-xs font-semibold uppercase tracking-wide text-muted">
                    {{ t('admin.files.table.headers.preview') }}
                  </p>
                  <div class="flex items-center justify-center overflow-hidden rounded-lg bg-default/60">
                    <img
                      :key="file.id"
                      :src="previewAttrs.src || file.imageUrl"
                      :srcset="previewAttrs.srcset"
                      :sizes="previewAttrs.srcset ? previewAttrs.sizes : undefined"
                      :alt="file.title || t('common.labels.untitled')"
                      :width="previewAttrs.width || file.width"
                      :height="previewAttrs.height || file.height"
                      loading="lazy"
                      class="h-auto max-h-[70vh] w-auto max-w-full object-contain"
                    >
                  </div>
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
                <UButton variant="soft" color="neutral" @click="handleClose">
                  <span class="flex items-center gap-1.5">
                    <Icon name="mdi:arrow-left" class="h-4 w-4" />
                    <span>{{ t('common.actions.cancel') }}</span>
                  </span>
                </UButton>
                <UButton color="primary" type="submit" :loading="loading">
                  <span class="flex items-center gap-1.5">
                    <Icon name="mdi:content-save-outline" class="h-4 w-4" />
                    <span>{{ t('common.actions.save') }}</span>
                  </span>
                </UButton>
              </div>
            </UForm>
          </UContainer>
        </div>
      </div>
    </template>
  </UModal>
</template>
