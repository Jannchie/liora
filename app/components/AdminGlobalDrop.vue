<script setup lang="ts">
/*
 * Signed-in admins can drop photos or videos anywhere in the app: the
 * files are staged in `usePendingUpload` and the upload page picks them
 * up. Real dropzones (anything marked `data-dropzone`, plus native file
 * inputs) keep their own behaviour — the overlay steps aside over them.
 */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { usePendingUpload } from '~/composables/usePendingUpload'
import { isImageFile, isVideoFile } from '~/utils/file'

const props = defineProps<{
  enabled: boolean
}>()

const { t } = useI18n()
const toast = useToast()
const route = useRouter().currentRoute
const { stage } = usePendingUpload()

const active = ref(false)

function carriesFiles(event: DragEvent): boolean {
  return event.dataTransfer?.types.includes('Files') ?? false
}

function overOwnDropzone(event: DragEvent): boolean {
  const target = event.target
  return target instanceof Element && Boolean(target.closest('[data-dropzone], input[type="file"]'))
}

function onDragOver(event: DragEvent): void {
  if (!carriesFiles(event)) {
    return
  }
  if (overOwnDropzone(event)) {
    active.value = false
    return
  }
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy'
  }
  active.value = true
}

function onDragLeave(event: DragEvent): void {
  // `relatedTarget` is null only when the pointer leaves the window.
  if (!event.relatedTarget) {
    active.value = false
  }
}

function onDrop(event: DragEvent): void {
  active.value = false
  if (event.defaultPrevented || overOwnDropzone(event)) {
    return
  }
  event.preventDefault()
  const files = [...(event.dataTransfer?.files ?? [])].filter(file => isImageFile(file) || isVideoFile(file))
  if (files.length === 0) {
    toast.add({ title: t('admin.upload.toast.selectImage'), color: 'error' })
    return
  }
  stage(files)
  if (route.value.path !== '/admin/upload') {
    void navigateTo('/admin/upload')
  }
}

function reset(): void {
  active.value = false
}

const listeners = [
  ['dragover', onDragOver],
  ['dragleave', onDragLeave],
  ['drop', onDrop],
  ['dragend', reset],
] as const

function listen(on: boolean): void {
  for (const [type, handler] of listeners) {
    if (on) {
      globalThis.addEventListener(type, handler as EventListener)
    } else {
      globalThis.removeEventListener(type, handler as EventListener)
    }
  }
}

// Listeners exist only while drops are allowed: anonymous visitors pay
// nothing for every dragover.
onMounted(() => {
  watch(
    () => props.enabled,
    enabled => {
      listen(enabled)
      if (!enabled) {
        reset()
      }
    },
    { immediate: true },
  )
})

onBeforeUnmount(() => {
  listen(false)
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-150"
      leave-active-class="transition-opacity duration-150"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <!-- Purely visual: pointer events fall through so the window
           listeners still see the real drop target. -->
      <div
        v-if="active"
        class="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8"
        style="background-color: color-mix(in srgb, var(--color-default) 82%, transparent); backdrop-filter: blur(6px)"
      >
        <div
          class="flex h-full w-full flex-col items-center justify-center gap-3 rounded-lg text-center shadow-[inset_0_0_0_1px_var(--color-primary)]"
        >
          <span class="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-primary">
            <Icon name="jannchie:cloud-upload" class="h-7 w-7" />
          </span>
          <p class="text-sm font-medium text-highlighted">
            {{ t('admin.upload.globalDrop.title') }}
          </p>
          <p class="text-xs text-dimmed">
            {{ t('admin.upload.globalDrop.hint') }}
          </p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
