<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    title?: string
    description?: string
    itemCount?: number
  }>(),
  {
    title: 'Liora Gallery',
    description: 'A minimal gallery for photography and illustrations.',
    itemCount: 0,
  },
)

const statsLabel = computed(() => {
  if (props.itemCount && props.itemCount > 0) {
    return `${props.itemCount} works curated`
  }
  return 'Curated gallery'
})

const baseFont = '"Noto Serif SC", "Noto Serif JP", "Playfair Display", "Georgia", serif'

const containerStyle: Record<string, string> = {
  display: 'flex',
  width: '100%',
  height: '100%',
  padding: '56px',
  boxSizing: 'border-box',
  background: '#0c0c0c',
  color: '#e5e5e5',
  gap: '40px',
  fontFamily: baseFont,
}

const textColumnStyle: Record<string, string> = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  gap: '18px',
  flex: '1 1 0',
  maxWidth: '640px',
}

const eyebrowStyle: Record<string, string> = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '10px 14px',
  background: '#1f1f1f',
  borderRadius: '9999px',
  color: '#d1d5db',
  fontSize: '16px',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  fontWeight: '700',
}

const eyebrowDotStyle: Record<string, string> = {
  width: '10px',
  height: '10px',
  borderRadius: '9999px',
  background: '#f5f5f5',
}

const titleStyle: Record<string, string> = {
  margin: '0',
  fontSize: '62px',
  lineHeight: '1.08',
  fontWeight: '800',
  color: '#f5f5f5',
}

const descriptionStyle: Record<string, string> = {
  margin: '0',
  fontSize: '24px',
  lineHeight: '1.5',
  color: '#cfcfcf',
}

const badgesStyle: Record<string, string> = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '12px',
  marginTop: '6px',
}

const primaryBadgeStyle: Record<string, string> = {
  display: 'flex',
  alignItems: 'center',
  padding: '12px 16px',
  borderRadius: '14px',
  background: '#161616',
  color: '#f5f5f5',
  border: '1px solid #2e2e2e',
  fontWeight: '700',
  fontSize: '16px',
}

const secondaryBadgeStyle: Record<string, string> = {
  display: 'flex',
  alignItems: 'center',
  padding: '12px 16px',
  borderRadius: '14px',
  background: '#1d1d1d',
  color: '#d6d6d6',
  fontWeight: '600',
  fontSize: '16px',
}

const gridStyle: Record<string, string> = {
  width: '360px',
  display: 'flex',
  flexWrap: 'wrap',
  gap: '12px',
  alignContent: 'center',
}

const blocks = computed<Record<string, string>[]>(() => [
  { background: '#202020', borderRadius: '16px', height: '152px', border: '1px solid #2e2e2e', width: '170px' },
  { background: '#2a2a2a', borderRadius: '16px', height: '120px', border: '1px solid #333333', width: '170px' },
  { background: '#1b1b1b', borderRadius: '16px', height: '140px', border: '1px solid #2a2a2a', width: '170px' },
  { background: '#141414', borderRadius: '16px', height: '160px', border: '1px solid #2e2e2e', width: '170px' },
  { background: '#242424', borderRadius: '16px', height: '124px', border: '1px solid #303030', width: '170px' },
  { background: '#1a1a1a', borderRadius: '16px', height: '148px', border: '1px solid #2c2c2c', width: '170px' },
])
</script>

<template>
  <div :style="containerStyle">
    <div :style="textColumnStyle">
      <div :style="eyebrowStyle">
        <span :style="eyebrowDotStyle" />
        <span>Liora gallery</span>
      </div>
      <h1 :style="titleStyle">
        {{ props.title }}
      </h1>
      <p :style="descriptionStyle">
        {{ props.description }}
      </p>
      <div :style="badgesStyle">
        <span :style="primaryBadgeStyle">{{ statsLabel }}</span>
        <span :style="secondaryBadgeStyle">Photography & illustration</span>
      </div>
    </div>
    <div :style="gridStyle">
      <div
        v-for="(block, index) in blocks"
        :key="index"
        :style="block"
      />
    </div>
  </div>
</template>
