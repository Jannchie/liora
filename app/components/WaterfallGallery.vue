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
            class="h-full w-full object-cover"
            v-bind="file.imageAttrs"
          >
        </div>
      </Waterfall>
    </div>
    <div v-if="isLoading" class="absolute inset-0 flex items-center justify-center">
      <span class="text-sm">加载中…</span>
    </div>
  </div>
</template>
