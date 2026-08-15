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
  <UCard class="overflow-hidden">
    <div class="flex flex-col gap-4">
      <div class="flex items-center gap-2">
        <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <Icon name="tabler:upload" class="h-5 w-5" />
        </span>
        <div class="min-w-0 space-y-0.5">
          <h2 class="text-sm font-semibold text-highlighted">
            {{ t('admin.upload.sections.upload.label') }}
          </h2>
          <p class="text-xs text-muted">
            {{ t('admin.upload.sections.upload.autoRouteHint') }}
          </p>
        </div>
      </div>
      <UFileUpload
        :ref="setFileUploadRef"
        :model-value="null"
        accept="image/*,video/*"
        :label="t('admin.upload.sections.upload.dropHint')"
        :description="t('admin.upload.sections.upload.supported')"
        class="w-full"
        @update:model-value="handleFile"
      />
    </div>
  </UCard>
</template>
