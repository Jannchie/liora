<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

const visible = ref(false)
const threshold = 600

function handleScroll(): void {
  visible.value = window.scrollY > threshold
}

function scrollToTop(): void {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll, { passive: true })
  handleScroll()
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', handleScroll)
})

const { t } = useI18n()
</script>

<template>
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
      icon="tabler:arrow-up"
      size="lg"
      color="neutral"
      variant="solid"
      square
      class="fixed bottom-6 right-6 z-40 shadow-lg"
      :aria-label="t('common.actions.backToTop')"
      @click="scrollToTop"
    />
  </Transition>
</template>
