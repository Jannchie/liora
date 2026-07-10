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
  <div class="min-h-screen w-full bg-bg text-default">
    <section class="mx-auto flex w-full max-w-6xl flex-col px-3 py-16 md:px-4 md:py-24">
      <p class="label-caption">
        {{ t('error.eyebrow') }}
      </p>

      <!-- The status code is the one loud element; everything else stays quiet. -->
      <p class="font-title num-tabular mt-6 text-6xl leading-none text-highlighted md:text-7xl">
        {{ statusCode }}
      </p>

      <h1 class="mt-6 text-2xl font-semibold tracking-tight text-highlighted md:text-3xl">
        {{ title }}
      </h1>
      <p class="mt-2 max-w-xl text-sm leading-relaxed text-muted">
        {{ description }}
      </p>

      <!-- The two facts worth knowing, set like a wall label. -->
      <dl class="mt-10 max-w-xl border-t border-border">
        <div class="flex items-baseline gap-4 border-b border-border-muted py-2.5">
          <dt class="label-caption-sm w-16 shrink-0">
            {{ t('error.statusLabel') }}
          </dt>
          <dd class="num-tabular text-xs text-toned">
            {{ statusCode }}
          </dd>
        </div>
        <div class="flex items-baseline gap-4 border-b border-border-muted py-2.5">
          <dt class="label-caption-sm w-16 shrink-0">
            {{ t('error.pathLabel') }}
          </dt>
          <dd class="truncate font-mono text-xs text-toned">
            {{ path }}
          </dd>
        </div>
      </dl>

      <div class="mt-8 flex flex-wrap gap-3">
        <UButton color="primary" @click="goHome">
          {{ t('error.actions.home') }}
        </UButton>
        <UButton color="neutral" variant="soft" @click="goSeries">
          {{ t('error.actions.series') }}
        </UButton>
      </div>
    </section>
  </div>
</template>
