<script setup lang="ts">
import type { NuxtError } from '#app'
import { computed } from 'vue'

const props = defineProps<{ error: NuxtError }>()

const { t } = useI18n()

const statusCode = computed(() => props.error?.statusCode ?? 500)
const isNotFound = computed(() => statusCode.value === 404)

const title = computed(() => isNotFound.value ? t('error.notFound.title') : t('error.generic.title'))

/*
 * A 404 is self-explanatory, so the copy stays generic and the path below
 * carries the specifics. Any other status may have a real message from the
 * server — show it rather than a stand-in.
 */
const description = computed(() => {
  if (isNotFound.value) {
    return t('error.notFound.description')
  }
  const message = props.error?.statusMessage?.trim() || props.error?.message?.trim()
  return message && message.length > 0 ? message : t('error.generic.description')
})

// NuxtError carries no path, and the error page renders outside the router's
// matched route, so read the request URL directly.
const requestUrl = useRequestURL()
const path = computed(() => requestUrl.pathname + requestUrl.search)

// i18n runs with strategy 'no_prefix', so routes need no locale prefix.
function goHome(): void {
  void clearError({ redirect: '/' })
}

function goSeries(): void {
  void clearError({ redirect: '/series' })
}
</script>

<template>
  <!--
    A single wireframe box in the middle of the page ground: caption row,
    the status code as the one loud element, the two facts worth knowing
    as hairline key/value rows, and an action row closing it off.
  -->
  <div class="flex min-h-screen w-full items-center justify-center bg-bg px-4 py-16 text-default">
    <section class="w-full max-w-xl overflow-hidden rounded-lg border border-border bg-default">
      <header class="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
        <p class="label-caption">
          {{ t('error.eyebrow') }}
        </p>
        <Icon name="jannchie:aperture" class="h-4 w-4 text-dimmed" />
      </header>

      <div class="px-5 pb-6 pt-7 sm:px-7">
        <p class="font-mono text-6xl leading-none tracking-[-0.02em] text-highlighted">
          {{ statusCode }}
        </p>
        <h1 class="mt-5 text-lg font-semibold tracking-[-0.01em] text-highlighted">
          {{ title }}
        </h1>
        <p class="mt-1.5 text-[13px] leading-relaxed text-dimmed">
          {{ description }}
        </p>
      </div>

      <dl class="border-t border-border">
        <div class="flex items-baseline gap-4 border-b border-border px-5 py-2.5 sm:px-7">
          <dt class="label-caption w-16 shrink-0">
            {{ t('error.statusLabel') }}
          </dt>
          <dd class="font-mono text-xs text-toned">
            {{ statusCode }}
          </dd>
        </div>
        <div class="flex items-baseline gap-4 px-5 py-2.5 sm:px-7">
          <dt class="label-caption w-16 shrink-0">
            {{ t('error.pathLabel') }}
          </dt>
          <dd class="min-w-0 truncate font-mono text-xs text-toned">
            {{ path }}
          </dd>
        </div>
      </dl>

      <footer class="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-3">
        <UButton color="neutral" variant="ghost" @click="goSeries">
          {{ t('error.actions.series') }}
        </UButton>
        <UButton color="primary" @click="goHome">
          {{ t('error.actions.home') }}
        </UButton>
      </footer>
    </section>
  </div>
</template>
