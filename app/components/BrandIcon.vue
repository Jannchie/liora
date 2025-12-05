<script setup lang="ts">
import type { StyleValue } from 'vue'
import simpleIcons from '@iconify-json/simple-icons/icons.json'
import { computed, nextTick, onMounted, ref, useAttrs, watchEffect } from 'vue'
import { brandIconKeys, brandIconSet } from '~/constants/brand-icons'

defineOptions({
  inheritAttrs: false,
})

const props = defineProps<{
  name: string
}>()

interface SimpleIcon {
  body: string
  width?: number
  height?: number
}

interface ViewBox {
  x: number
  y: number
  width: number
  height: number
}

const attrs = useAttrs()

const collection = simpleIcons as { icons: Record<string, SimpleIcon>, width?: number, height?: number }
const collectionWidth = collection.width ?? 24
const collectionHeight = collection.height ?? 24

const brandIcons: Record<string, SimpleIcon | undefined> = {}
for (const key of brandIconKeys) {
  brandIcons[key] = collection.icons[key]
}

const icon = computed<SimpleIcon | null>(() => {
  const rawName = props.name?.trim()
  if (!rawName) {
    return null
  }
  const normalized = rawName.replace(/^simple-icons:/, '').toLowerCase()
  if (!brandIconSet.has(normalized)) {
    return null
  }
  return brandIcons[normalized] ?? null
})

const defaultBox = computed<ViewBox>(() => {
  const width = icon.value?.width ?? collectionWidth
  const height = icon.value?.height ?? collectionHeight
  return { x: 0, y: 0, width, height }
})

const measuredBox = ref<ViewBox | null>(null)
const shapeRef = ref<SVGGElement | null>(null)

async function measureBoundingBox(): Promise<void> {
  await nextTick()
  const node = shapeRef.value
  if (!node) {
    return
  }
  try {
    const box = node.getBBox()
    if (box.width > 0 && box.height > 0) {
      measuredBox.value = { x: box.x, y: box.y, width: box.width, height: box.height }
      return
    }
  }
  catch {
    // ignore getBBox errors
  }
  measuredBox.value = null
}

onMounted(() => {
  watchEffect(() => {
    if (!icon.value) {
      return
    }
    measuredBox.value = null
    void measureBoundingBox()
  })
})

const viewBox = computed<string | null>(() => {
  if (!icon.value) {
    return null
  }
  const box = measuredBox.value ?? defaultBox.value
  return `${box.x} ${box.y} ${box.width} ${box.height}`
})

const iconStyle = computed<StyleValue | undefined>(() => {
  if (!icon.value) {
    return
  }
  const box = measuredBox.value ?? defaultBox.value
  const ratio = box.height === 0 ? 1 : box.width / box.height
  return {
    height: '1em',
    width: `${ratio}em`,
  }
})

const mergedStyle = computed<StyleValue[]>(() => {
  const base: StyleValue[] = []
  if (iconStyle.value) {
    base.push(iconStyle.value)
  }
  const attrStyle = attrs.style as StyleValue | undefined
  if (attrStyle) {
    base.push(attrStyle)
  }
  return base
})

const passthroughAttrs = computed<Record<string, unknown>>(() => {
  const { class: _class, style: _style, ...rest } = attrs
  return rest
})
</script>

<template>
  <svg
    v-if="icon && viewBox"
    :viewBox="viewBox"
    xmlns="http://www.w3.org/2000/svg"
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
    role="img"
    :class="attrs.class"
    :style="mergedStyle"
    v-bind="passthroughAttrs"
  >
    <g ref="shapeRef" v-html="icon.body" />
  </svg>
</template>
