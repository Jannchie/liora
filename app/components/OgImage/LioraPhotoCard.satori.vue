<script setup lang="ts">
import type { BrandIconKey } from '~/constants/brand-icons'
import { computed } from 'vue'
import { brandLogoPaths } from '~/constants/brand-logo-paths'

const props = withDefaults(
  defineProps<{
    /** IPX-proxied jpeg path — satori cannot decode webp/avif originals. */
    imageUrl?: string
    /** Brand logo key, e.g. "sony"; falls back to `brandLabel` when unknown. */
    brand?: string
    brandLabel?: string
    /** Camera model with the brand already stripped, e.g. "ILCE-7M4". */
    camera?: string
    /** Lens line; the shot's focal length is appended by the caller. */
    lens?: string
    /** Exposure triad, segments joined by " · ": aperture · shutter · ISO. */
    exposure?: string
  }>(),
  {
    imageUrl: '',
    brand: '',
    brandLabel: '',
    camera: '',
    lens: '',
    exposure: '',
  },
)

/* Cropping to the logo's ink bounds lets a wordmark (Sony, Fujifilm) and a
   square mark (Apple) sit at the same optical weight beside the model name. */
const LOGO_HEIGHT = 21

const brandLogo = computed(() => brandLogoPaths[props.brand as BrandIconKey])

const brandLogoWidth = computed(() => {
  const box = brandLogo.value?.box
  return box ? Math.round((LOGO_HEIGHT * box[2]) / box[3]) : 0
})

/* Satori renders vnodes, not markup, so an inline <svg> never reaches it —
   the logo goes in as an <img> on a self-contained data URI instead. The path
   data is pure ASCII, which keeps btoa safe here. */
const brandLogoUrl = computed(() => {
  const logo = brandLogo.value
  if (!logo) {
    return ''
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${brandLogoWidth.value}" height="${LOGO_HEIGHT}" viewBox="${logo.box.join(' ')}" fill="#ffffff"><path d="${logo.d}"/></svg>`
  return `data:image/svg+xml;base64,${btoa(svg)}`
})

const exposureSegments = computed(() => props.exposure
  .split(' · ')
  .map(segment => segment.trim().replace(/^f\//, 'ƒ/'))
  .filter(segment => segment.length > 0))

const hasGearRow = computed(() => Boolean(props.camera || brandLogoUrl.value || props.brandLabel))

/* Inter ships with nuxt-og-image; the Noto fallbacks cover CJK glyphs. */
const baseFont = 'Inter, "Noto Sans SC", "Noto Serif SC", sans-serif'

/* Satori has no filters, so the caption carries its own shadow rather than
   relying on the scrim alone — a bright sky under the text still reads. */
const textShadow = '0 1px 2px rgba(0,0,0,0.55), 0 2px 14px rgba(0,0,0,0.45)'

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

const scrimStyle: Record<string, string> = {
  position: 'absolute',
  top: '0',
  left: '0',
  width: '100%',
  height: '100%',
  background: 'linear-gradient(180deg, rgba(0,0,0,0) 58%, rgba(0,0,0,0.62) 100%)',
}

const contentStyle: Record<string, string> = {
  position: 'absolute',
  left: '0',
  right: '0',
  bottom: '0',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '0 56px 46px',
}

const gearRowStyle: Record<string, string> = {
  display: 'flex',
  alignItems: 'center',
  gap: '11px',
}

const logoStyle = computed<Record<string, string>>(() => ({
  display: 'flex',
  flexShrink: '0',
  width: `${brandLogoWidth.value}px`,
  height: `${LOGO_HEIGHT}px`,
}))

const cameraStyle: Record<string, string> = {
  margin: '0',
  fontSize: '27px',
  fontWeight: '600',
  lineHeight: '1.1',
  letterSpacing: '-0.005em',
  color: '#ffffff',
  textShadow,
}

const lensStyle: Record<string, string> = {
  margin: '8px 0 0',
  fontSize: '16px',
  fontWeight: '400',
  lineHeight: '1.2',
  letterSpacing: '0.02em',
  color: 'rgba(255,255,255,0.76)',
  textShadow,
}

/* A hairline instead of a gap: separates the exposure data from the gear
   names at one glance, and costs a single 1px element. */
const ruleStyle: Record<string, string> = {
  display: 'flex',
  width: '40px',
  height: '1px',
  margin: '16px 0',
  background: 'rgba(255,255,255,0.36)',
}

const exposureRowStyle: Record<string, string> = {
  display: 'flex',
  alignItems: 'center',
  gap: '17px',
}

const exposureSegmentStyle: Record<string, string> = {
  margin: '0',
  fontSize: '18px',
  fontWeight: '500',
  lineHeight: '1',
  letterSpacing: '0.06em',
  color: 'rgba(255,255,255,0.95)',
  textShadow,
}

const dividerStyle: Record<string, string> = {
  display: 'flex',
  width: '3px',
  height: '3px',
  borderRadius: '9999px',
  background: 'rgba(255,255,255,0.5)',
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
      <div v-if="hasGearRow" :style="gearRowStyle">
        <img
          v-if="brandLogoUrl"
          :src="brandLogoUrl"
          :style="logoStyle"
        >
        <p v-else-if="props.brandLabel" :style="cameraStyle">
          {{ props.brandLabel }}
        </p>
        <p v-if="props.camera" :style="cameraStyle">
          {{ props.camera }}
        </p>
      </div>
      <p v-if="props.lens" :style="lensStyle">
        {{ props.lens }}
      </p>
      <div v-if="exposureSegments.length > 0 && (hasGearRow || props.lens)" :style="ruleStyle" />
      <div :style="exposureRowStyle">
        <template v-for="(segment, index) in exposureSegments" :key="segment">
          <div v-if="index > 0" :style="dividerStyle" />
          <p :style="exposureSegmentStyle">
            {{ segment }}
          </p>
        </template>
      </div>
    </div>
  </div>
</template>
