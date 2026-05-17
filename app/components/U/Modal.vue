<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'

const isClient = import.meta.client

const props = withDefaults(defineProps<{
  open?: boolean
  title?: string
  description?: string
  fullscreen?: boolean
  scrollable?: boolean
  closable?: boolean
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  ui?: {
    overlay?: string
    wrapper?: string
    content?: string
  }
}>(), {
  closable: true,
  size: 'md',
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  'close': []
}>()

const open = computed({
  get: () => props.open ?? false,
  set: (value) => emit('update:open', value),
})

function close(): void {
  if (!props.closable) return
  open.value = false
  emit('close')
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && open.value) {
    close()
  }
}

function setBodyScroll(locked: boolean): void {
  if (!import.meta.client) return
  document.body.style.overflow = locked ? 'hidden' : ''
}

watch(open, (next) => {
  setBodyScroll(next)
}, { immediate: true })

onMounted(() => {
  if (!import.meta.client) return
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  if (!import.meta.client) return
  document.removeEventListener('keydown', onKeydown)
  setBodyScroll(false)
})

const wrapperClass = computed(() => {
  if (props.fullscreen) {
    return 'fixed inset-0 z-[71] flex'
  }
  return 'fixed inset-0 z-[71] flex items-center justify-center p-4'
})

const sizeWidth: Record<NonNullable<typeof props.size>, string> = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
  '2xl': 'max-w-6xl',
}

const contentClass = computed(() => {
  const base = 'relative bg-default text-foreground shadow-[var(--shadow-lg)] ring-1 ring-[var(--color-border)]'
  if (props.fullscreen) {
    return `${base} h-full w-full overflow-hidden`
  }
  return `${base} w-full ${sizeWidth[props.size]} rounded-2xl ${props.scrollable ? 'max-h-[90vh] overflow-auto' : ''}`
})
</script>

<template>
  <Teleport v-if="isClient" to="body">
    <Transition
      enter-active-class="transition duration-150"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-100"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="open">
        <div
          class="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm"
          :class="ui?.overlay"
          @click="close"
        />
        <div
          :class="[wrapperClass, ui?.wrapper]"
          role="dialog"
          aria-modal="true"
          :aria-label="title"
          :aria-description="description"
        >
          <slot
            name="content"
            :close="close"
            :title="title"
            :description="description"
          >
            <div
              :class="[contentClass, ui?.content]"
              @click.stop
            >
              <header v-if="title || description" class="flex items-start justify-between gap-3 border-b border-[var(--color-border-muted)] px-5 py-4">
                <div class="space-y-1">
                  <h3 v-if="title" class="text-base font-semibold text-highlighted">
                    {{ title }}
                  </h3>
                  <p v-if="description" class="text-xs text-muted">
                    {{ description }}
                  </p>
                </div>
                <button
                  v-if="closable"
                  type="button"
                  class="rounded-md p-1 text-muted outline-none transition hover:bg-muted hover:text-highlighted focus-visible:shadow-[var(--ring-focus)]"
                  :aria-label="'Close'"
                  @click="close"
                >
                  <Icon name="tabler:x" class="h-4 w-4" />
                </button>
              </header>
              <div class="px-5 py-5">
                <slot />
              </div>
            </div>
          </slot>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
