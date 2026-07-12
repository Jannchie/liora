<script setup lang="ts">
import type { FileResponse } from '~/types/file'
import type { ResolvedFile } from '~/types/gallery'
import { computed, onBeforeUnmount, ref, toRaw, watch } from 'vue'
import { recomposeCssMatrix } from '#shared/utils/recompose'
import { useRecomposeEditor } from '~/composables/useRecomposeEditor'

const props = defineProps<{
  file: FileResponse | ResolvedFile | null
}>()

const emit = defineEmits<{
  (event: 'saved', value: FileResponse): void
}>()

const open = defineModel<boolean>('open', { required: true })

const { t } = useI18n()
const toast = useToast()
const image = useImage()
const { updateRecompose } = useFileEditApi()

const editor = ref<ReturnType<typeof useRecomposeEditor> | null>(null)
const saving = ref(false)

watch(open, (isOpen) => {
  editor.value = isOpen && props.file
    ? useRecomposeEditor({
        width: props.file.width,
        height: props.file.height,
        recompose: props.file.metadata.recompose,
      })
    : null
})

const previewSrc = computed<string>(() => {
  const src = props.file?.imageUrl?.trim() ?? ''
  if (!src) {
    return ''
  }
  const resized = image.getImage(src, {
    modifiers: {
      width: 2048,
      fit: 'inside',
      format: 'webp',
      quality: 85,
    },
  })
  return resized?.url ?? src
})

const stageEl = ref<HTMLElement | null>(null)
const stageSize = ref({ width: 0, height: 0 })
let stageObserver: ResizeObserver | null = null

watch(stageEl, (next) => {
  stageObserver?.disconnect()
  stageObserver = null
  if (!next) {
    stageSize.value = { width: 0, height: 0 }
    return
  }
  stageSize.value = { width: next.clientWidth, height: next.clientHeight }
  stageObserver = new ResizeObserver((entries) => {
    const entry = entries[0]
    if (entry) {
      stageSize.value = { width: entry.contentRect.width, height: entry.contentRect.height }
    }
  })
  stageObserver.observe(next)
})

onBeforeUnmount(() => {
  stageObserver?.disconnect()
  stageObserver = null
})

const STAGE_PADDING = 48

const stageScale = computed<number>(() => {
  const state = editor.value
  if (!state) {
    return 0
  }
  const availableWidth = stageSize.value.width - STAGE_PADDING
  const availableHeight = stageSize.value.height - STAGE_PADDING
  if (availableWidth <= 0 || availableHeight <= 0) {
    return 0
  }
  const { planeWidth, planeHeight } = state.plane
  const scale = Math.min(availableWidth / planeWidth, availableHeight / planeHeight)
  return Number.isFinite(scale) && scale > 0 ? scale : 0
})

const planeStyle = computed(() => {
  const state = editor.value
  const scale = stageScale.value
  if (!state || scale <= 0) {
    return null
  }
  return {
    width: `${state.plane.planeWidth * scale}px`,
    height: `${state.plane.planeHeight * scale}px`,
  }
})

const imageWrapperStyle = computed(() => {
  const state = editor.value
  const scale = stageScale.value
  if (!state || scale <= 0) {
    return null
  }
  const fullCropParams = {
    ...state.params,
    crop: { x: 0, y: 0, width: 1, height: 1 },
    original: { ...state.params.original },
  }
  return {
    position: 'absolute' as const,
    left: '0',
    top: '0',
    width: `${state.params.original.width * scale}px`,
    height: `${state.params.original.height * scale}px`,
    transform: recomposeCssMatrix(fullCropParams, scale),
    transformOrigin: '0 0',
  }
})

interface AspectPreset {
  key: string
  label: string
  value: number | null
}

const aspectPresets = computed<AspectPreset[]>(() => {
  const original = editor.value?.params.original
  return [
    { key: 'free', label: t('admin.files.recompose.aspect.free'), value: null },
    {
      key: 'original',
      label: t('admin.files.recompose.aspect.original'),
      value: original ? original.width / original.height : null,
    },
    { key: '1:1', label: '1:1', value: 1 },
    { key: '3:2', label: '3:2', value: 3 / 2 },
    { key: '2:3', label: '2:3', value: 2 / 3 },
    { key: '4:3', label: '4:3', value: 4 / 3 },
    { key: '3:4', label: '3:4', value: 3 / 4 },
    { key: '16:9', label: '16:9', value: 16 / 9 },
    { key: '9:16', label: '9:16', value: 9 / 16 },
  ]
})

const activeAspectKey = ref<string>('free')

function selectAspect(preset: AspectPreset): void {
  activeAspectKey.value = preset.key
  editor.value?.applyAspect(preset.key === 'free' ? null : preset.value)
}

watch(open, () => {
  activeAspectKey.value = 'free'
})

function handleClose(): void {
  open.value = false
}

async function handleSave(): Promise<void> {
  const state = editor.value
  const file = props.file
  if (!state || !file || saving.value) {
    return
  }
  saving.value = true
  try {
    const payload = state.isIdentity
      ? null
      : structuredClone(toRaw(state.params))
    const updated = await updateRecompose(file.id, payload)
    toast.add({
      title: payload === null
        ? t('admin.files.recompose.toast.resetDone')
        : t('admin.files.recompose.toast.saved'),
      color: 'success',
    })
    emit('saved', updated)
    open.value = false
  }
  catch (error) {
    const message = error instanceof Error ? error.message : ''
    toast.add({ title: t('admin.files.recompose.toast.failed'), description: message, color: 'error' })
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    fullscreen
    :title="t('admin.files.recompose.title')"
    :description="file?.title || t('common.labels.untitled')"
    :ui="{
      overlay: 'z-80',
      wrapper: 'z-81',
      content: 'fixed inset-0 z-82 w-screen h-screen max-w-none max-h-none rounded-none p-0 sm:p-0 top-0! left-0! translate-x-0! translate-y-0! m-0!',
    }"
  >
    <template #content>
      <div class="flex h-full flex-col bg-bg">
        <header class="flex items-start justify-between gap-3 border-b border-border-muted bg-bg/95 px-6 py-4">
          <div class="min-w-0 space-y-1">
            <p class="label-caption">
              {{ t('admin.files.recompose.title') }}
            </p>
            <h3 class="truncate text-lg font-semibold text-highlighted">
              {{ file?.title || t('common.labels.untitled') }}
            </h3>
          </div>
          <UButton variant="ghost" color="neutral" icon="tabler:x" :aria-label="t('common.actions.close')" @click="handleClose" />
        </header>

        <div class="flex min-h-0 flex-1 flex-col lg:flex-row">
          <!-- STAGE -->
          <div
            ref="stageEl"
            class="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black"
          >
            <div v-if="editor && planeStyle" class="relative" :style="planeStyle">
              <div v-if="imageWrapperStyle" :style="imageWrapperStyle">
                <img
                  :src="previewSrc"
                  :alt="file?.title || ''"
                  class="h-full w-full select-none"
                  draggable="false"
                >
              </div>
              <AdminRecomposeCropOverlay
                :crop="editor.params.crop"
                :plane-width="editor.plane.planeWidth"
                :plane-height="editor.plane.planeHeight"
                :scale="stageScale"
                :locked-aspect="editor.lockedAspect"
                @update:crop="editor.setCrop($event)"
                @drag-end="editor.constrainCrop()"
              />
            </div>
          </div>

          <!-- CONTROLS -->
          <aside v-if="editor" class="w-full shrink-0 space-y-6 overflow-y-auto border-t border-border-muted p-5 lg:w-80 lg:border-l lg:border-t-0">
            <USection :label="t('admin.files.recompose.aspect.label')" icon="tabler:crop" divider="none">
              <div class="flex flex-wrap gap-1.5">
                <UButton
                  v-for="preset in aspectPresets"
                  :key="preset.key"
                  size="sm"
                  type="button"
                  :color="activeAspectKey === preset.key ? 'primary' : 'neutral'"
                  :variant="activeAspectKey === preset.key ? 'soft' : 'ghost'"
                  @click="selectAspect(preset)"
                >
                  {{ preset.label }}
                </UButton>
              </div>
            </USection>

            <USection :label="t('admin.files.recompose.rotate.label')" icon="tabler:rotate-clockwise-2" divider="none">
              <div class="flex flex-wrap gap-1.5">
                <UButton size="sm" type="button" color="neutral" variant="ghost" icon="tabler:rotate-clockwise-2" @click="editor.rotate90(1)">
                  {{ t('admin.files.recompose.rotate.cw') }}
                </UButton>
                <UButton size="sm" type="button" color="neutral" variant="ghost" icon="tabler:rotate-2" @click="editor.rotate90(-1)">
                  {{ t('admin.files.recompose.rotate.ccw') }}
                </UButton>
                <UButton
                  size="sm"
                  type="button"
                  :color="editor.params.flipH ? 'primary' : 'neutral'"
                  variant="ghost"
                  icon="tabler:flip-vertical"
                  @click="editor.flip('h')"
                >
                  {{ t('admin.files.recompose.rotate.flipH') }}
                </UButton>
                <UButton
                  size="sm"
                  type="button"
                  :color="editor.params.flipV ? 'primary' : 'neutral'"
                  variant="ghost"
                  icon="tabler:flip-horizontal"
                  @click="editor.flip('v')"
                >
                  {{ t('admin.files.recompose.rotate.flipV') }}
                </UButton>
              </div>
            </USection>

            <USection :label="t('admin.files.recompose.straighten')" icon="tabler:angle" divider="none">
              <div class="flex items-center gap-2 num-tabular text-[11px]">
                <input
                  type="range"
                  min="-45"
                  max="45"
                  step="0.1"
                  :value="editor.params.straighten"
                  class="h-1 w-full cursor-pointer accent-primary"
                  @input="editor.setStraighten(Number(($event.target as HTMLInputElement).value))"
                >
                <span class="w-14 shrink-0 text-right tabular-nums text-highlighted">{{ editor.params.straighten.toFixed(1) }}°</span>
              </div>
            </USection>

            <USection :label="t('admin.files.recompose.stretch.label')" icon="tabler:arrows-horizontal" divider="none">
              <div class="space-y-2">
                <div class="flex items-center gap-2 num-tabular text-[11px]">
                  <span class="w-10 shrink-0 text-muted">{{ t('admin.files.recompose.stretch.x') }}</span>
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.01"
                    :value="editor.params.stretchX"
                    class="h-1 w-full cursor-pointer accent-primary"
                    @input="editor.setStretch('x', Number(($event.target as HTMLInputElement).value))"
                  >
                  <span class="w-12 shrink-0 text-right tabular-nums text-highlighted">{{ editor.params.stretchX.toFixed(2) }}×</span>
                </div>
                <div class="flex items-center gap-2 num-tabular text-[11px]">
                  <span class="w-10 shrink-0 text-muted">{{ t('admin.files.recompose.stretch.y') }}</span>
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.01"
                    :value="editor.params.stretchY"
                    class="h-1 w-full cursor-pointer accent-primary"
                    @input="editor.setStretch('y', Number(($event.target as HTMLInputElement).value))"
                  >
                  <span class="w-12 shrink-0 text-right tabular-nums text-highlighted">{{ editor.params.stretchY.toFixed(2) }}×</span>
                </div>
              </div>
            </USection>

            <USection :label="t('admin.files.recompose.perspective.label')" icon="tabler:perspective" divider="none">
              <div class="space-y-2">
                <div class="flex items-center gap-2 num-tabular text-[11px]">
                  <span class="w-10 shrink-0 text-muted">{{ t('admin.files.recompose.perspective.h') }}</span>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.01"
                    :value="editor.params.perspectiveH"
                    class="h-1 w-full cursor-pointer accent-primary"
                    @input="editor.setPerspective('h', Number(($event.target as HTMLInputElement).value))"
                  >
                  <span class="w-12 shrink-0 text-right tabular-nums text-highlighted">{{ editor.params.perspectiveH.toFixed(2) }}</span>
                </div>
                <div class="flex items-center gap-2 num-tabular text-[11px]">
                  <span class="w-10 shrink-0 text-muted">{{ t('admin.files.recompose.perspective.v') }}</span>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.01"
                    :value="editor.params.perspectiveV"
                    class="h-1 w-full cursor-pointer accent-primary"
                    @input="editor.setPerspective('v', Number(($event.target as HTMLInputElement).value))"
                  >
                  <span class="w-12 shrink-0 text-right tabular-nums text-highlighted">{{ editor.params.perspectiveV.toFixed(2) }}</span>
                </div>
              </div>
            </USection>

            <dl class="space-y-1 border-t border-border-muted pt-3 num-tabular text-[11px]">
              <div class="flex items-baseline justify-between gap-2">
                <dt class="text-muted">
                  {{ t('admin.files.recompose.framedSize') }}
                </dt>
                <dd class="tabular-nums text-highlighted">
                  {{ editor.framedDims.width }} × {{ editor.framedDims.height }}
                </dd>
              </div>
            </dl>
            <p class="text-xs leading-relaxed text-muted">
              {{ t('admin.files.recompose.hint') }}
            </p>
          </aside>
        </div>

        <footer class="flex items-center justify-between gap-2 border-t border-border-muted bg-bg/95 px-6 py-3">
          <UButton
            variant="ghost"
            color="neutral"
            icon="tabler:restore"
            :disabled="!editor || editor.isIdentity"
            @click="editor?.reset()"
          >
            {{ t('common.actions.reset') }}
          </UButton>
          <div class="flex items-center gap-2">
            <UButton variant="ghost" color="neutral" @click="handleClose">
              {{ t('common.actions.cancel') }}
            </UButton>
            <UButton
              color="primary"
              type="button"
              icon="tabler:device-floppy"
              :loading="saving"
              @click="handleSave"
            >
              {{ t('common.actions.save') }}
            </UButton>
          </div>
        </footer>
      </div>
    </template>
  </UModal>
</template>
