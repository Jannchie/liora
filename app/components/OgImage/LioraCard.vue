<script setup lang="ts">
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

const baseFont = '"Noto Serif SC", "Noto Serif JP", "Playfair Display", "Georgia", serif'

const containerStyle: Record<string, string> = {
  display: 'flex',
  width: '100%',
  height: '100%',
  padding: '72px',
  boxSizing: 'border-box',
  background: '#e7e7e7',
  color: '#1f1f1f',
  gap: '32px',
  fontFamily: baseFont,
  position: 'relative',
  alignItems: 'center',
  overflow: 'hidden',
}

const textColumnStyle: Record<string, string> = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  gap: '14px',
  flex: '1 1 0',
  maxWidth: '720px',
  zIndex: '1',
}

const titleStyle: Record<string, string> = {
  margin: '0',
  fontSize: '68px',
  lineHeight: '1.05',
  fontWeight: '700',
  color: '#0f0f0f',
}

const descriptionStyle: Record<string, string> = {
  margin: '0',
  fontSize: '24px',
  lineHeight: '1.55',
  color: '#303030',
}

const frameOffset = 36
const frameThickness = 8
const frameSize = 170
const frameCornerBaseStyle: Record<string, string> = {
  position: 'absolute',
  width: `${frameSize}px`,
  height: `${frameSize}px`,
  border: `${frameThickness}px solid #0f0f0f`,
  borderRadius: '0',
  boxSizing: 'border-box',
}

const framePositions: Record<'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight', Record<string, string>> = {
  topLeft: {
    top: `${frameOffset}px`,
    left: `${frameOffset}px`,
    borderRight: 'none',
    borderBottom: 'none',
  },
  topRight: {
    top: `${frameOffset}px`,
    right: `${frameOffset}px`,
    borderLeft: 'none',
    borderBottom: 'none',
  },
  bottomLeft: {
    bottom: `${frameOffset}px`,
    left: `${frameOffset}px`,
    borderRight: 'none',
    borderTop: 'none',
  },
  bottomRight: {
    bottom: `${frameOffset}px`,
    right: `${frameOffset}px`,
    borderLeft: 'none',
    borderTop: 'none',
  },
}
</script>

<template>
  <div :style="containerStyle">
    <div
      v-for="(style, corner) in framePositions"
      :key="corner"
      :style="[frameCornerBaseStyle, style]"
    />
    <div :style="textColumnStyle">
      <h1 :style="titleStyle">
        {{ props.title }}
      </h1>
      <p :style="descriptionStyle">
        {{ props.description }}
      </p>
    </div>
  </div>
</template>
