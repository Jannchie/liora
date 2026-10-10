<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

const visible = ref(false)
const threshold = 600

function updateVisibility(): void {
  visible.value = window.scrollY > threshold
}

let scrollRafId: number | null = null

function handleScroll(): void {
  if (scrollRafId !== null) {
    return
  }
  scrollRafId = globalThis.requestAnimationFrame(() => {
    scrollRafId = null
    updateVisibility()
  })
}

function scrollToTop(): void {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll, { passive: true })
  updateVisibility()
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', handleScroll)
  if (scrollRafId !== null) {
    globalThis.cancelAnimationFrame(scrollRafId)
    scrollRafId = null
  }
})

const { t } = useI18n()
</script>

<template>
  <!-- A floating control, so it is one of the few surfaces allowed a shadow:
       frosted like the header, ruled by a strong hairline. -->
  <Transition
    enter-active-class="transition duration-200 ease-out"
    leave-active-class="transition duration-200 ease-in"
    enter-from-class="opacity-0 translate-y-2"
    enter-to-class="opacity-100 translate-y-0"
    leave-from-class="opacity-100 translate-y-0"
    leave-to-class="opacity-0 translate-y-2"
  >
    <UButton
      v-if="visible"
      type="button"
      icon="jannchie:arrow-up"
      size="lg"
      color="neutral"
      variant="outline"
      square
      class="wire-bar fixed bottom-6 right-6 z-40 text-highlighted shadow-md"
      :aria-label="t('common.actions.backToTop')"
      @click="scrollToTop"
    />
  </Transition>
</template>
