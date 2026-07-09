<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    /** IPX-proxied jpeg path — satori cannot decode webp/avif originals. */
    imageUrl?: string
    /** Exposure line, segments joined by " · ": aperture · shutter · focal · ISO. */
    exposure?: string
    siteName?: string
  }>(),
  {
    imageUrl: '',
    exposure: '',
    siteName: 'Liora Gallery',
  },
)

const exposureSegments = computed(() => props.exposure
  .split(' · ')
  .map(segment => segment.trim().replace(/^f\//, 'ƒ/'))
  .filter(segment => segment.length > 0))

/* Inter ships with nuxt-og-image; the Noto fallbacks cover CJK glyphs. */
const baseFont = 'Inter, "Noto Sans SC", "Noto Serif SC", sans-serif'

const containerStyle: Record<string, string> = {
  display: 'flex',
  width: '100%',
  height: '100%',
  position: 'relative',
  background: '#1a1a1a',
  fontFamily: baseFont,
  overflow: 'hidden',
}

const photoStyle: Record<string, string> = {
  position: 'absolute',
  top: '0',
  left: '0',
  width: '100%',
  height: '100%',
  objectFit: 'cover',
}

/* Keeps the caption legible on any photo without framing the image itself. */
const scrimStyle: Record<string, string> = {
  position: 'absolute',
  top: '0',
  left: '0',
  width: '100%',
  height: '100%',
  background: 'linear-gradient(180deg, rgba(0,0,0,0) 66%, rgba(0,0,0,0.58) 100%)',
}

const contentStyle: Record<string, string> = {
  position: 'absolute',
  left: '0',
  right: '0',
  bottom: '0',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '48px',
  padding: '44px 56px',
}

const exposureRowStyle: Record<string, string> = {
  display: 'flex',
  alignItems: 'center',
  gap: '26px',
}

const exposureSegmentStyle: Record<string, string> = {
  margin: '0',
  fontSize: '21px',
  fontWeight: '500',
  lineHeight: '1',
  letterSpacing: '0.08em',
  color: 'rgba(255,255,255,0.95)',
}

const dividerStyle: Record<string, string> = {
  display: 'flex',
  width: '1px',
  height: '18px',
  background: 'rgba(255,255,255,0.32)',
}

const siteNameStyle: Record<string, string> = {
  margin: '0',
  fontSize: '15px',
  fontWeight: '400',
  lineHeight: '1',
  letterSpacing: '0.26em',
  textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.66)',
  flexShrink: '0',
}
</script>

<template>
  <div :style="containerStyle">
    <img
      v-if="props.imageUrl"
      :src="props.imageUrl"
      :style="photoStyle"
    >
    <div :style="scrimStyle" />
    <div :style="contentStyle">
      <div :style="exposureRowStyle">
        <template v-for="(segment, index) in exposureSegments" :key="segment">
          <div v-if="index > 0" :style="dividerStyle" />
          <p :style="exposureSegmentStyle">
            {{ segment }}
          </p>
        </template>
      </div>
      <p :style="siteNameStyle">
        {{ props.siteName }}
      </p>
    </div>
  </div>
</template>
