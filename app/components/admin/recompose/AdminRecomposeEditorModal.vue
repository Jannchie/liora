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
      <div class="flex h-full flex-col bg-default">
        <header class="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
          <div class="min-w-0 space-y-0.5">
            <p class="label-caption">
              {{ t('admin.files.recompose.title') }}
            </p>
            <h3 class="truncate text-[15px] font-semibold tracking-[-0.01em] text-highlighted">
              {{ file?.title || t('common.labels.untitled') }}
            </h3>
          </div>
          <UButton variant="ghost" color="neutral" icon="jannchie:x" :aria-label="t('common.actions.close')" @click="handleClose" />
        </header>

        <div class="flex min-h-0 flex-1 flex-col lg:flex-row">
          <!-- STAGE: the photo is the hero, so the canvas stays black in both themes. -->
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

          <!-- CONTROLS: a detail column of hairline-separated sections, one line per seam. -->
          <aside
            v-if="editor"
            class="recompose-controls flex max-h-[45vh] w-full shrink-0 flex-col overflow-y-auto border-t border-border bg-default lg:max-h-none lg:w-[340px] lg:border-t-0 lg:border-l"
          >
            <div class="border-b border-border px-5 py-4">
              <USection :label="t('admin.files.recompose.aspect.label')" icon="jannchie:crop">
                <div class="flex flex-wrap gap-1">
                  <UButton
                    v-for="preset in aspectPresets"
                    :key="preset.key"
                    size="sm"
                    type="button"
                    color="neutral"
                    variant="ghost"
                    :aria-pressed="activeAspectKey === preset.key"
                    :class="preset.key.includes(':') ? 'tabular-nums' : ''"
                    @click="selectAspect(preset)"
                  >
                    {{ preset.label }}
                  </UButton>
                </div>
              </USection>
            </div>

            <div class="border-b border-border px-5 py-4">
              <USection :label="t('admin.files.recompose.rotate.label')" icon="jannchie:rotate">
                <div class="flex flex-wrap gap-1">
                  <UButton size="sm" type="button" color="neutral" variant="ghost" icon="jannchie:rotate" @click="editor.rotate90(1)">
                    {{ t('admin.files.recompose.rotate.cw') }}
                  </UButton>
                  <UButton size="sm" type="button" color="neutral" variant="ghost" icon="jannchie:rotate-ccw" @click="editor.rotate90(-1)">
                    {{ t('admin.files.recompose.rotate.ccw') }}
                  </UButton>
                  <UButton
                    size="sm"
                    type="button"
                    color="neutral"
                    variant="ghost"
                    icon="jannchie:flip-vertical"
                    :aria-pressed="editor.params.flipH"
                    @click="editor.flip('h')"
                  >
                    {{ t('admin.files.recompose.rotate.flipH') }}
                  </UButton>
                  <UButton
                    size="sm"
                    type="button"
                    color="neutral"
                    variant="ghost"
                    icon="jannchie:flip"
                    :aria-pressed="editor.params.flipV"
                    @click="editor.flip('v')"
                  >
                    {{ t('admin.files.recompose.rotate.flipV') }}
                  </UButton>
                </div>
              </USection>
            </div>

            <div class="border-b border-border px-5 py-4">
              <USection :label="t('admin.files.recompose.straighten')" icon="jannchie:angle">
                <div class="flex items-center gap-3">
                  <input
                    type="range"
                    min="-45"
                    max="45"
                    step="0.1"
                    :value="editor.params.straighten"
                    :style="{ '--p': `${(editor.params.straighten + 45) / 90 * 100}%` }"
                    class="recompose-slider"
                    @input="editor.setStraighten(Number(($event.target as HTMLInputElement).value))"
                  >
                  <span class="w-14 shrink-0 text-right text-xs tabular-nums text-highlighted">{{ editor.params.straighten.toFixed(1) }}°</span>
                </div>
              </USection>
            </div>

            <div class="border-b border-border px-5 py-4">
              <USection :label="t('admin.files.recompose.stretch.label')" icon="jannchie:arrows-horizontal">
                <div class="space-y-1">
                  <div class="flex items-center gap-3">
                    <span class="w-10 shrink-0 text-[13px] text-dimmed">{{ t('admin.files.recompose.stretch.x') }}</span>
                    <input
                      type="range"
                      min="0.5"
                      max="2"
                      step="0.01"
                      :value="editor.params.stretchX"
                      :style="{ '--p': `${(editor.params.stretchX - 0.5) / 1.5 * 100}%` }"
                      class="recompose-slider"
                      @input="editor.setStretch('x', Number(($event.target as HTMLInputElement).value))"
                    >
                    <span class="w-12 shrink-0 text-right text-xs tabular-nums text-highlighted">{{ editor.params.stretchX.toFixed(2) }}×</span>
                  </div>
                  <div class="flex items-center gap-3">
                    <span class="w-10 shrink-0 text-[13px] text-dimmed">{{ t('admin.files.recompose.stretch.y') }}</span>
                    <input
                      type="range"
                      min="0.5"
                      max="2"
                      step="0.01"
                      :value="editor.params.stretchY"
                      :style="{ '--p': `${(editor.params.stretchY - 0.5) / 1.5 * 100}%` }"
                      class="recompose-slider"
                      @input="editor.setStretch('y', Number(($event.target as HTMLInputElement).value))"
                    >
                    <span class="w-12 shrink-0 text-right text-xs tabular-nums text-highlighted">{{ editor.params.stretchY.toFixed(2) }}×</span>
                  </div>
                </div>
              </USection>
            </div>

            <div class="border-b border-border px-5 py-4">
              <USection :label="t('admin.files.recompose.perspective.label')" icon="jannchie:perspective">
                <div class="space-y-1">
                  <div class="flex items-center gap-3">
                    <span class="w-10 shrink-0 text-[13px] text-dimmed">{{ t('admin.files.recompose.perspective.h') }}</span>
                    <input
                      type="range"
                      min="-1"
                      max="1"
                      step="0.01"
                      :value="editor.params.perspectiveH"
                      :style="{ '--p': `${(editor.params.perspectiveH + 1) / 2 * 100}%` }"
                      class="recompose-slider"
                      @input="editor.setPerspective('h', Number(($event.target as HTMLInputElement).value))"
                    >
                    <span class="w-12 shrink-0 text-right text-xs tabular-nums text-highlighted">{{ editor.params.perspectiveH.toFixed(2) }}</span>
                  </div>
                  <div class="flex items-center gap-3">
                    <span class="w-10 shrink-0 text-[13px] text-dimmed">{{ t('admin.files.recompose.perspective.v') }}</span>
                    <input
                      type="range"
                      min="-1"
                      max="1"
                      step="0.01"
                      :value="editor.params.perspectiveV"
                      :style="{ '--p': `${(editor.params.perspectiveV + 1) / 2 * 100}%` }"
                      class="recompose-slider"
                      @input="editor.setPerspective('v', Number(($event.target as HTMLInputElement).value))"
                    >
                    <span class="w-12 shrink-0 text-right text-xs tabular-nums text-highlighted">{{ editor.params.perspectiveV.toFixed(2) }}</span>
                  </div>
                </div>
              </USection>
            </div>

            <!-- Readout + hint close the column; nothing follows, so no bottom hairline. -->
            <div class="space-y-3 px-5 py-4">
              <dl class="flex items-baseline justify-between gap-2">
                <dt class="label-caption">
                  {{ t('admin.files.recompose.framedSize') }}
                </dt>
                <dd class="text-xs tabular-nums text-highlighted">
                  {{ editor.framedDims.width }} × {{ editor.framedDims.height }}
                </dd>
              </dl>
              <p class="text-xs leading-relaxed text-dimmed">
                {{ t('admin.files.recompose.hint') }}
              </p>
            </div>
          </aside>
        </div>

        <footer class="flex items-center justify-between gap-2 border-t border-border bg-default px-5 py-3">
          <UButton
            variant="ghost"
            color="neutral"
            icon="jannchie:undo"
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
              icon="jannchie:save"
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

<style scoped>
/* Thin scrollbar so the control column reads as a quiet rail. */
.recompose-controls {
  scrollbar-width: thin;
  scrollbar-color: var(--color-border-strong) transparent;
}

/* Icons-site slider: 2px hairline track, ink progress (`--p` set inline, WebKit has no range-progress), 10px solid ink dot. */
.recompose-slider {
  flex: 1;
  min-width: 0;
  height: 26px;
  margin: 0;
  padding: 0;
  background: none;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
}
.recompose-slider:focus-visible {
  outline: none;
}
.recompose-slider::-webkit-slider-runnable-track {
  height: 2px;
  border-radius: 1px;
  background:
    linear-gradient(var(--color-primary), var(--color-primary)) 0 / var(--p, 50%) 100% no-repeat,
    var(--color-border-strong);
}
.recompose-slider::-moz-range-track {
  height: 2px;
  border-radius: 1px;
  background: var(--color-border-strong);
}
.recompose-slider::-moz-range-progress {
  height: 2px;
  border-radius: 1px;
  background: var(--color-primary);
}
.recompose-slider::-webkit-slider-thumb {
  width: 10px;
  height: 10px;
  margin-top: -4px;
  border: 0;
  border-radius: 50%;
  background: var(--color-primary);
  -webkit-appearance: none;
  appearance: none;
}
.recompose-slider::-moz-range-thumb {
  width: 10px;
  height: 10px;
  border: 0;
  border-radius: 50%;
  background: var(--color-primary);
}
/* Kept as two rules: a selector list mixing vendor pseudo-elements is dropped whole by each engine. */
.recompose-slider:focus-visible::-webkit-slider-thumb {
  outline: 2px solid var(--color-border-strong);
  outline-offset: 2px;
}
.recompose-slider:focus-visible::-moz-range-thumb {
  outline: 2px solid var(--color-border-strong);
  outline-offset: 2px;
}
</style>
