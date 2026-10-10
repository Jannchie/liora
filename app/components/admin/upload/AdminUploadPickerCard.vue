<script setup lang="ts">
/*
 * Single dropzone for both still photos and Live Photo videos.
 * The mode toggle is gone — the picker accepts image/* + video/* and the
 * parent classifies by MIME on receipt:
 *   image/* → still photo path
 *   video/* → live photo path (cover frame extracted client-side)
 *
 * Why: the prior toggle made users pick a mode before dropping a file
 * even though the file type itself already disambiguates. One affordance,
 * less to learn, and paste flow stays identical.
 */
defineProps<{
  setFileUploadRef: (instance: unknown) => void
}>()

const emit = defineEmits<{
  /** Fired with the picked File (or null on clear). Parent routes by type. */
  pick: [file: File | null]
}>()

const { t } = useI18n()

function handleFile(file: File | null): void {
  emit('pick', file)
}
</script>

<template>
  <!-- A page band of its own: caption row, then the dropzone. No card —
       the band's bottom hairline is the only frame. -->
  <section class="wire-band space-y-4">
    <header class="space-y-1">
      <p class="label-caption flex items-center gap-2">
        <Icon name="jannchie:upload" class="h-3.5 w-3.5" />
        <span>{{ t('admin.upload.sections.upload.label') }}</span>
      </p>
      <p class="text-[13px] text-dimmed">
        {{ t('admin.upload.sections.upload.autoRouteHint') }}
      </p>
    </header>
    <UFileUpload
      :ref="setFileUploadRef"
      :model-value="null"
      accept="image/*,video/*"
      :label="t('admin.upload.sections.upload.dropHint')"
      :description="t('admin.upload.sections.upload.supported')"
      class="w-full"
      @update:model-value="handleFile"
    />
  </section>
</template>
