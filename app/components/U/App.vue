<script setup lang="ts">
import { useToast, useToastStore, type ToastColor } from '~/composables/useToast'

const toastStore = useToastStore()
const toast = useToast()

const colorClass: Record<ToastColor, string> = {
  primary: 'border-l-4 border-l-[var(--color-primary)]',
  error: 'border-l-4 border-l-[var(--color-error)]',
  warning: 'border-l-4 border-l-[var(--color-warning)]',
  success: 'border-l-4 border-l-[var(--color-success)]',
  info: 'border-l-4 border-l-[var(--color-info)]',
  neutral: 'border-l-4 border-l-[var(--color-border-strong)]',
}

const iconFor: Record<ToastColor, string> = {
  primary: 'tabler:circle-check',
  error: 'tabler:alert-octagon',
  warning: 'tabler:alert-triangle',
  success: 'tabler:circle-check',
  info: 'tabler:info-circle',
  neutral: 'tabler:bell',
}

const iconColorClass: Record<ToastColor, string> = {
  primary: 'text-primary',
  error: 'text-error',
  warning: 'text-warning',
  success: 'text-success',
  info: 'text-info',
  neutral: 'text-muted',
}
</script>

<template>
  <slot />
  <!--
    Teleport into Nuxt's stable `#teleports` div instead of `body` + v-if.
    Why: with `v-if="isClient"`, SSR rendered nothing while the client mounted
    a new node, so hydration matched the client's toast container against
    Nuxt's empty `<div id="teleports">` and warned about a class mismatch
    (server class was empty/"null", client wanted the toast container class).
    Teleporting to `#teleports` makes SSR and client both render the toast
    container inside that stable target.
  -->
  <Teleport to="#teleports">
    <div class="pointer-events-none fixed inset-x-0 bottom-0 z-[9999] flex flex-col items-center gap-2 px-4 pb-4 sm:bottom-4 sm:left-auto sm:right-4 sm:items-end sm:px-0">
      <TransitionGroup
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0 translate-y-2"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0 translate-y-1"
      >
        <div
          v-for="item in toastStore.items"
          :key="item.id"
          class="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg bg-default px-3 py-2.5 shadow-[var(--shadow-lg)] ring-1 ring-[var(--color-border)]"
          :class="colorClass[item.color]"
          role="status"
        >
          <Icon :name="iconFor[item.color]" class="mt-0.5 h-4 w-4 shrink-0" :class="iconColorClass[item.color]" />
          <div class="min-w-0 flex-1 space-y-0.5">
            <p class="text-sm font-semibold text-highlighted">
              {{ item.title }}
            </p>
            <p v-if="item.description" class="text-xs text-muted">
              {{ item.description }}
            </p>
          </div>
          <button
            type="button"
            class="shrink-0 rounded-md p-0.5 text-muted outline-none transition hover:bg-muted hover:text-highlighted focus-visible:shadow-[var(--ring-focus)]"
            :aria-label="'Dismiss'"
            @click="toast.remove(item.id)"
          >
            <Icon name="tabler:x" class="h-3.5 w-3.5" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
