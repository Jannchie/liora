<script setup lang="ts">
import { usePreferredDark } from '@vueuse/core'
import { computed, onMounted, ref, watch, watchEffect } from 'vue'

/*
 * Three-state colour-mode toggle: auto / light / dark.
 *
 * Why we don't use `useColorMode` directly:
 *   useColorMode either applies an empty class for "auto" (so CSS can't pick
 *   anything up) or resolves auto to light/dark on getter — but the two
 *   modes contradict each other when emitAuto=true. We need *both* the raw
 *   user pick (for icon display) AND a resolved class on <html>. Easier to
 *   own the small state machine ourselves.
 *
 * The pre-hydration inline script in nuxt.config.ts reads the same storage
 * key and applies the resolved class before first paint, so there's no
 * dark→light flash on reload.
 *
 * userMode is intentionally NOT read from localStorage during setup — that
 * would diverge from the SSR-rendered default ('auto') and trigger Vue's
 * hydration mismatch warning. We sync from storage after mount instead.
 */

type Mode = 'auto' | 'light' | 'dark'

const STORAGE_KEY = 'liora-color-mode'

function readStoredMode(): Mode {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY)?.replaceAll(/^['"]|['"]$/g, '')
    if (raw === 'light' || raw === 'dark' || raw === 'auto') {
      return raw
    }
  }
  catch {
    /* localStorage may be inaccessible in private mode */
  }
  return 'auto'
}

const userMode = ref<Mode>('auto')
const hasMounted = ref(false)

onMounted(() => {
  userMode.value = readStoredMode()
  hasMounted.value = true
  watch(userMode, (value) => {
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, value)
    }
    catch {
      /* ignore */
    }
  })
})

const prefersDark = usePreferredDark()

const resolved = computed<'light' | 'dark'>(() => {
  if (userMode.value === 'dark') {
    return 'dark'
  }
  if (userMode.value === 'light') {
    return 'light'
  }
  return prefersDark.value ? 'dark' : 'light'
})

watchEffect(() => {
  if (!import.meta.client) {
    return
  }
  // Don't touch <html> classes before mount — the pre-hydration inline script
  // has already applied the correct class, and userMode is still the SSR
  // default ('auto') here, which would override the user's real preference.
  if (!hasMounted.value) {
    return
  }
  const html = document.documentElement
  // Suppress transitions for one frame so colour-scheme swaps instantly
  // instead of cross-fading through every `transition-colors` element.
  html.classList.add('disable-transitions')
  html.classList.remove('light', 'dark')
  html.classList.add(resolved.value)
  // Force reflow so the disable-transitions class is committed alongside
  // the new theme class before the next paint.
  void html.offsetHeight
  requestAnimationFrame(() => {
    html.classList.remove('disable-transitions')
  })
})

const cycle: Record<Mode, Mode> = {
  auto: 'light',
  light: 'dark',
  dark: 'auto',
}

const icon = computed(() => {
  switch (userMode.value) {
    case 'light': { return 'tabler:sun'
    }
    case 'dark': { return 'tabler:moon'
    }
    default: { return 'tabler:device-laptop'
    }
  }
})

const label = computed(() => {
  switch (userMode.value) {
    case 'light': { return 'Light'
    }
    case 'dark': { return 'Dark'
    }
    default: { return 'Auto'
    }
  }
})

function nextMode(): void {
  userMode.value = cycle[userMode.value] ?? 'auto'
}
</script>

<template>
  <button
    type="button"
    class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-elevated leading-none text-muted outline-none transition-colors duration-150 ease-out hover:bg-accented focus-visible:shadow-[var(--ring-focus)]"
    :title="`Theme: ${label} (click to cycle)`"
    :aria-label="`Switch theme (current: ${label})`"
    @click="nextMode"
  >
    <Icon :name="icon" class="h-4 w-4 shrink-0" />
  </button>
</template>
