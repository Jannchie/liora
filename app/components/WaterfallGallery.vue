<script setup lang="ts">
import type { ImageSizes } from '@nuxt/image'
import type { FileResponse } from '~/types/file'
import { thumbHashToApproximateAspectRatio, thumbHashToDataURL } from 'thumbhash'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Waterfall } from 'vue-wf'

const props = withDefaults(
  defineProps<{
    files: FileResponse[]
    isLoading: boolean
    emptyText?: string
    scrollElement?: HTMLElement
  }>(),
  {
    emptyText: '暂无数据',
    scrollElement: undefined,
  },
)

const maxDisplayWidth = 400
const waterfallGap = 4
const image = useImage()

type ImageAttrs = ImageSizes & {
  src: string
  width?: number
  height?: number
}

function getInitialColumns(): number {
  if (globalThis.window !== undefined) {
    return Math.max(1, Math.ceil(window.innerWidth / maxDisplayWidth))
  }
  return 3
}

const galleryRef = ref<HTMLElement | null>(null)
const columns = ref<number>(getInitialColumns())
const wrapperWidth = ref<number>(maxDisplayWidth * columns.value + waterfallGap * (columns.value - 1))
const activeFile = ref<ResolvedFile | null>(null)

interface ThumbhashInfo {
  dataUrl: string
  aspectRatio: number
}

interface DisplaySize {
  width: number
  height: number
}

type ResolvedFile = FileResponse & {
  coverUrl: string
  placeholder?: string
  placeholderAspectRatio?: number
  displaySize: DisplaySize
  imageAttrs: ImageAttrs
}

interface MetadataEntry {
  label: string
  value: string
}

function toByteArrayFromBase64(value: string): Uint8Array {
  if (typeof atob === 'function') {
    const binary = atob(value)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.codePointAt(index) || 0
    }
    return bytes
  }
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(value, 'base64'))
  }
  throw new Error('No base64 decoder available.')
}

function decodeThumbhash(value: string | undefined): ThumbhashInfo | undefined {
  if (!value) {
    return undefined
  }
  try {
    const bytes = toByteArrayFromBase64(value)
    const aspectRatio = thumbHashToApproximateAspectRatio(bytes)
    if (!Number.isFinite(aspectRatio) || aspectRatio <= 0) {
      return {
        dataUrl: thumbHashToDataURL(bytes),
        aspectRatio: 1,
      }
    }
    return {
      dataUrl: thumbHashToDataURL(bytes),
      aspectRatio,
    }
  }
  catch (error) {
    console.warn('Failed to decode thumbhash', error)
    return undefined
  }
}

function toTimestamp(value: string | undefined): number | null {
  if (!value) {
    return null
  }
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : parsed
}

function resolveSortTimestamp(file: FileResponse): number {
  const captureTimestamp = toTimestamp(file.metadata.captureTime)
  const createdTimestamp = toTimestamp(file.createdAt) ?? 0
  return captureTimestamp ?? createdTimestamp
}

function computeDisplaySize(file: FileResponse, aspectRatio?: number): DisplaySize {
  const width = file.width > 0 ? Math.min(file.width, maxDisplayWidth) : maxDisplayWidth
  const ratio
    = aspectRatio && Number.isFinite(aspectRatio) && aspectRatio > 0
      ? aspectRatio
      : (file.width > 0 && file.height > 0
          ? file.width / file.height
          : 1)
  const height = Math.round(width / ratio)
  return { width, height }
}

function resolveImageAttrs(src: string, displaySize: DisplaySize): ImageAttrs {
  const modifiers = {
    width: displaySize.width,
    height: displaySize.height,
    format: 'webp',
    fit: 'cover',
  }
  const sizes = image.getSizes(src, {
    modifiers,
    sizes: `${maxDisplayWidth}px`,
  })
  const resolvedSrc
    = sizes.src
    ?? image.getImage(src, {
      modifiers,
    }).url
  return {
    ...sizes,
    src: resolvedSrc,
    width: displaySize.width,
    height: displaySize.height,
  }
}

const resolvedFiles = computed<ResolvedFile[]>(() =>
  [...props.files]
    .map((file) => {
      const decoded = decodeThumbhash(file.metadata.thumbhash)
      const displaySize = computeDisplaySize(file, decoded?.aspectRatio)
      const coverUrl = file.thumbnailUrl?.trim() || file.imageUrl
      return {
        ...file,
        coverUrl,
        placeholder: decoded?.dataUrl,
        placeholderAspectRatio: decoded?.aspectRatio,
        displaySize,
        imageAttrs: resolveImageAttrs(coverUrl, displaySize),
      }
    })
    .toSorted((first, second) => resolveSortTimestamp(second) - resolveSortTimestamp(first)),
)

const waterfallItems = computed(() => resolvedFiles.value.map(file => file.displaySize))

const resizeObserver = ref<ResizeObserver | null>(null)

function updateColumns(): void {
  const width = galleryRef.value?.clientWidth ?? null
  if (typeof width === 'number' && Number.isFinite(width) && width > 0) {
    const target = Math.max(1, Math.ceil(width / maxDisplayWidth))
    columns.value = target
    wrapperWidth.value = width
  }
}

onMounted(() => {
  updateColumns()
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver.value = new ResizeObserver(() => updateColumns())
    if (galleryRef.value) {
      resizeObserver.value.observe(galleryRef.value)
    }
  }
})

onBeforeUnmount(() => {
  resizeObserver.value?.disconnect()
})

function openOverlay(file: ResolvedFile): void {
  activeFile.value = file
}

function closeOverlay(): void {
  activeFile.value = null
}

function toDisplayText(value: string | null | undefined): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

const metadataEntries = computed<MetadataEntry[]>(() => {
  const file = activeFile.value
  if (!file) {
    return []
  }
  const { metadata } = file
  const entries: MetadataEntry[] = []
  const title = toDisplayText(file.title)
  if (title) {
    entries.push({ label: '标题', value: title })
  }
  const description = toDisplayText(file.description)
  if (description) {
    entries.push({ label: '描述', value: description })
  }
  const fanworkTitle = toDisplayText(metadata.fanworkTitle || file.fanworkTitle)
  if (fanworkTitle) {
    entries.push({ label: '作品', value: fanworkTitle })
  }
  if (metadata.characters.length > 0) {
    entries.push({ label: '角色', value: metadata.characters.join('、') })
  }
  const locationName = toDisplayText(metadata.locationName || file.location)
  if (locationName) {
    entries.push({ label: '地点', value: locationName })
  }
  const cameraModel = toDisplayText(metadata.cameraModel || file.cameraModel)
  if (cameraModel) {
    entries.push({ label: '设备', value: cameraModel })
  }
  const aperture = toDisplayText(metadata.aperture)
  const focalLength = toDisplayText(metadata.focalLength)
  const iso = toDisplayText(metadata.iso)
  const shutterSpeed = toDisplayText(metadata.shutterSpeed)
  const exposureParts = [aperture, focalLength, iso, shutterSpeed].filter(Boolean) as string[]
  if (exposureParts.length > 0) {
    entries.push({ label: '参数', value: exposureParts.join(' · ') })
  }
  const captureTime = toDisplayText(metadata.captureTime)
  if (captureTime) {
    entries.push({ label: '拍摄时间', value: captureTime })
  }
  entries.push({ label: '尺寸', value: `${file.width} × ${file.height}` })
  return entries
})

const overlayBackgroundStyle = computed<Record<string, string> | null>(() => {
  const file = activeFile.value
  if (!file) {
    return null
  }
  const source = file.placeholder ?? file.coverUrl
  return {
    backgroundImage: `url('${source}')`,
  }
})
</script>

<template>
  <div ref="galleryRef" class="relative">
    <div v-if="resolvedFiles.length === 0 && !isLoading" class="flex h-full items-center justify-center text-sm">
      {{ emptyText }}
    </div>
    <div v-else>
      <Waterfall
        :gap="waterfallGap"
        :cols="columns"
        :items="waterfallItems"
        :wrapper-width="wrapperWidth"
        :scroll-element="scrollElement"
      >
        <div
          v-for="file in resolvedFiles"
          :key="file.id"
        >
          <button
            type="button"
            class="group relative block h-full w-full focus:outline-none"
            :aria-label="`查看 ${file.title || '作品'} 大图`"
            @click="openOverlay(file)"
          >
            <img
              :key="file.id"
              :alt="file.title"
              :style="
                file.placeholder
                  ? {
                    backgroundImage: `url(${file.placeholder})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                  }
                  : undefined
              "
              loading="lazy"
              class="h-full w-full object-cover transition duration-200 group-hover:opacity-90"
              v-bind="file.imageAttrs"
            >
          </button>
        </div>
      </Waterfall>
    </div>
    <div v-if="isLoading" class="absolute inset-0 flex items-center justify-center">
      <span class="text-sm">加载中…</span>
    </div>
    <Teleport to="body">
      <div
        v-if="activeFile"
        class="fixed inset-0 z-50"
        role="dialog"
        aria-modal="true"
      >
        <div
          v-if="overlayBackgroundStyle"
          class="pointer-events-none absolute inset-0 scale-110 bg-cover bg-center blur-3xl"
          :style="overlayBackgroundStyle"
          aria-hidden="true"
        />
        <div class="absolute inset-0" @click="closeOverlay" />
        <div class="relative flex h-full w-full">
          <div class="relative z-10 grid h-full w-full grid-cols-1 gap-4 bg-[var(--ui-bg)] text-[var(--ui-text)] backdrop-blur md:grid-cols-[minmax(0,2fr)_minmax(280px,360px)] md:gap-6">
            <div class="flex min-h-0 items-center justify-center overflow-hidden bg-[var(--ui-bg-muted)]">
              <img
                :src="activeFile.imageUrl"
                :alt="activeFile.title"
                class="max-h-full max-w-full object-contain"
              >
            </div>
            <div class="flex min-h-0 flex-col gap-4 overflow-y-auto p-4 md:p-6">
              <div class="flex items-start justify-between gap-3">
                <div class="space-y-1">
                  <p class="text-xs uppercase tracking-wide text-muted">
                    {{ activeFile.kind === 'PHOTOGRAPHY' ? '摄影' : '插画' }}
                  </p>
                  <h3 class="text-lg font-semibold leading-snug">
                    {{ activeFile.title || '未命名作品' }}
                  </h3>
                </div>
                <button
                  type="button"
                  class="px-3 py-1 text-sm text-default ring-1 ring-default transition hover:bg-muted"
                  @click="closeOverlay"
                >
                  关闭
                </button>
              </div>
              <div class="space-y-3 text-sm text-default">
                <div
                  v-for="item in metadataEntries"
                  :key="item.label"
                  class="bg-elevated p-3"
                >
                  <p class="text-xs font-semibold uppercase tracking-wide text-muted">
                    {{ item.label }}
                  </p>
                  <p class="mt-1 whitespace-pre-line wrap-break-word leading-relaxed text-highlighted">
                    {{ item.value }}
                  </p>
                </div>
                <div v-if="metadataEntries.length === 0" class="bg-elevated p-3">
                  <p class="text-xs font-semibold uppercase tracking-wide text-muted">
                    元数据
                  </p>
                  <p class="mt-1 text-highlighted">
                    暂无元数据
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
