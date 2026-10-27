<script setup lang="ts">
/*
 * Single dropzone for both still photos and Live Photo videos.
 * The mode toggle is gone — the picker accepts several image/* + video/*
 * files and the parent classifies them on receipt:
 *   image/* → still photo path (motion photos split into still + video)
 *   image + same-named video → live photo with its original still
 *   video/* → live photo path (cover frame extracted client-side)
 *   several entries → batch queue
 *
 * Why: the prior toggle made users pick a mode before dropping a file
 * even though the file type itself already disambiguates. One affordance,
 * less to learn, and paste flow stays identical.
 */
defineProps<{
  setFileUploadRef: (instance: unknown) => void
}>()

const emit = defineEmits<{
  /** Fired with the picked files. Parent routes by type and count. */
  pick: [files: File[]]
}>()

const { t } = useI18n()

// UFileUpload types its value as a single File here even with `multiple`
// (the generic isn't inferred), so accept both shapes. The model stays
// null: the parent owns the picked files, the dropzone only reports them.
function handleFiles(value: File | File[] | null | undefined): void {
  emit('pick', Array.isArray(value) ? value : value ? [value] : [])
}
</script>

<template>
  <!-- A page band of its own, and the band *is* the dropzone: caption,
       hint and drop prompt are one click / drop target. The band's bottom
       hairline is the only frame. -->
  <UFileUpload
    :ref="setFileUploadRef"
    :model-value="null"
    accept="image/*,video/*"
    multiple
    :label="t('admin.upload.sections.upload.dropHint')"
    :description="t('admin.upload.sections.upload.supported')"
    class="wire-band w-full"
    @update:model-value="handleFiles"
  >
    <header class="space-y-1">
      <p class="label-caption flex items-center gap-2">
        <Icon name="jannchie:upload" class="h-3.5 w-3.5" />
        <span>{{ t('admin.upload.sections.upload.label') }}</span>
      </p>
      <p class="text-[13px] text-dimmed">
        {{ t('admin.upload.sections.upload.autoRouteHint') }}
      </p>
    </header>
  </UFileUpload>
</template>
