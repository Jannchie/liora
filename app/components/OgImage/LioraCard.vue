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
  padding: '56px',
  boxSizing: 'border-box',
  background: '#0c0c0c',
  color: '#e5e5e5',
  gap: '32px',
  fontFamily: baseFont,
}

const textColumnStyle: Record<string, string> = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  gap: '14px',
  flex: '1 1 0',
  maxWidth: '720px',
}

const titleStyle: Record<string, string> = {
  margin: '0',
  fontSize: '68px',
  lineHeight: '1.05',
  fontWeight: '700',
  color: '#f5f5f5',
}

const descriptionStyle: Record<string, string> = {
  margin: '0',
  fontSize: '24px',
  lineHeight: '1.55',
  color: '#d6d6d6',
}
</script>

<template>
  <div :style="containerStyle">
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
