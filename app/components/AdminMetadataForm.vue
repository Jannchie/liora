<script setup lang="ts">
import type { MediaFormState } from '~/types/admin'
import { computed, ref, watch } from 'vue'
import { useExposureOptions } from '~/composables/useExposureOptions'
import { useLocationSearch } from '~/composables/useLocationSearch'
import { toIsoWithOffset } from '~/utils/datetime'

const props = withDefaults(defineProps<{
  classifySource?: {
    file?: File | null
    imageUrl?: string | null
  }
}>(), {
  classifySource: () => ({
    file: null,
    imageUrl: null,
  }),
})

const form = defineModel<MediaFormState>('form', { required: true })
const captureTimeLocal = defineModel<string>('captureTimeLocal', { required: true })

const { t } = useI18n()
const toast = useToast()
const {
  exposureProgramOptions,
  exposureModeOptions,
  meteringModeOptions,
  whiteBalanceOptions,
  flashOptions,
} = useExposureOptions()
const { geocodeQuery, geocoding, geocodeResults, searchLocation, applyGeocodeResult } = useLocationSearch(form.value)
const classifyingGenre = ref(false)

const formShell = computed(
  () => 'mx-auto flex w-full max-w-6xl flex-col gap-5 lg:gap-6',
)
const sectionCard = computed(() => 'space-y-4 rounded-2xl border border-default/50 bg-default/70 p-4 lg:p-5')
const sectionLayout = computed(() => 'space-y-4')
const baseGrid = computed(() => 'grid grid-cols-12 gap-3 lg:gap-4')
const halfCol = computed(() => 'col-span-12 md:col-span-6')
const thirdCol = computed(() => 'col-span-12 md:col-span-6 xl:col-span-4')
const genreOptions = computed(() => [
  { label: t('admin.files.genreOptions.portrait'), value: 'PORTRAIT' },
  { label: t('admin.files.genreOptions.landscape'), value: 'LANDSCAPE' },
  { label: t('admin.files.genreOptions.documentary'), value: 'DOCUMENTARY' },
  { label: t('admin.files.genreOptions.architecture'), value: 'ARCHITECTURE' },
  { label: t('admin.files.genreOptions.animal'), value: 'ANIMAL' },
  { label: t('admin.files.genreOptions.stillLife'), value: 'STILL_LIFE' },
  { label: t('admin.files.genreOptions.fashion'), value: 'FASHION' },
  { label: t('admin.files.genreOptions.sports'), value: 'SPORTS' },
  { label: t('admin.files.genreOptions.aerial'), value: 'AERIAL' },
  { label: t('admin.files.genreOptions.fineArt'), value: 'FINE_ART' },
  { label: t('admin.files.genreOptions.commercial'), value: 'COMMERCIAL' },
  { label: t('admin.files.genreOptions.macro'), value: 'MACRO' },
  { label: t('admin.files.genreOptions.street'), value: 'STREET' },
  { label: t('admin.files.genreOptions.night'), value: 'NIGHT' },
  { label: t('admin.files.genreOptions.abstract'), value: 'ABSTRACT' },
  { label: t('admin.files.genreOptions.other'), value: 'OTHER' },
])
const classifyMessages = computed(() => ({
  missing: t('admin.upload.toast.genreAutoMissingSource'),
  failedTitle: t('admin.upload.toast.genreAutoFailedTitle'),
  failedFallback: t('admin.upload.toast.genreAutoFailedFallback'),
}))
interface ExposureHighlight {
  label: string
  value: string
  icon: string
}
const canReverseGeocode = computed(() => {
  const lat = form.value.latitude
  const lng = form.value.longitude
  return typeof lat === 'number' && Number.isFinite(lat) && typeof lng === 'number' && Number.isFinite(lng)
})
const classificationSource = computed(() => props.classifySource ?? { file: null, imageUrl: null })
const canAutoClassify = computed(() => {
  const file = classificationSource.value.file
  const imageUrl = classificationSource.value.imageUrl
  const hasFile = typeof File !== 'undefined' && file instanceof File && file.size > 0
  const hasUrl = typeof imageUrl === 'string' && imageUrl.trim().length > 0
  return hasFile || hasUrl
})
const exposureHighlights = computed<ExposureHighlight[]>(() => [
  { label: t('admin.upload.fields.aperture.label'), value: form.value.aperture || '—', icon: 'mdi:camera-iris' },
  { label: t('admin.upload.fields.shutterSpeed.label'), value: form.value.shutterSpeed || '—', icon: 'mdi:camera-timer' },
  { label: 'ISO', value: form.value.iso || '—', icon: 'mdi:brightness-6' },
])

interface GenreClassificationPayload {
  genre?: string
  result?: {
    primary: string
    secondary: string[]
    confidence: number | null
    reason: string
    model: string
    updatedAt: string
  } | null
}

async function autoClassifyGenre(): Promise<void> {
  if (classifyingGenre.value) {
    return
  }
  if (!canAutoClassify.value) {
    toast.add({ title: classifyMessages.value.missing, color: 'warning' })
    return
  }

  classifyingGenre.value = true
  const file = classificationSource.value.file
  const imageUrl = classificationSource.value.imageUrl?.trim() ?? ''
  try {
    let response: GenreClassificationPayload
    if (typeof File !== 'undefined' && file instanceof File && file.size > 0) {
      const body = new FormData()
      body.append('file', file)
      response = await $fetch<GenreClassificationPayload>('/api/files/classify', {
        method: 'POST',
        body,
      })
    }
    else {
      response = await $fetch<GenreClassificationPayload>('/api/files/classify', {
        method: 'POST',
        body: { imageUrl },
      })
    }

    const genre = response.genre?.trim() ?? ''
    if (genre) {
      form.value.genre = genre
    }
  }
  catch (error) {
    const description = error instanceof Error ? error.message : classifyMessages.value.failedFallback
    toast.add({ title: classifyMessages.value.failedTitle, description, color: 'error' })
  }
  finally {
    classifyingGenre.value = false
  }
}

watch(
  () => captureTimeLocal.value,
  (value) => {
    if (!form.value) {
      return
    }
    form.value.captureTime = value ? toIsoWithOffset(value) : ''
  },
)
</script>

<template>
  <section :class="formShell">
    <section :class="sectionCard">
      <div :class="sectionLayout">
        <div class="flex items-start gap-2 rounded-lg bg-elevated/60 px-3 py-2">
          <Icon name="mdi:shape-outline" class="h-4 w-4 text-primary" />
          <div>
            <p class="text-xs font-semibold uppercase tracking-wide text-muted">
              {{ t('admin.upload.formSections.basic.label') }}
            </p>
            <p class="text-sm text-toned">
              {{ t('admin.upload.formSections.basic.description') }}
            </p>
          </div>
        </div>
        <div class="flex w-full flex-col gap-4">
          <div class="space-y-3 rounded-xl border border-default/50 bg-elevated/70 p-3">
            <UFormField :label="t('admin.files.form.title.label')" name="title">
              <UInput v-model="form.title" class="w-full" :placeholder="t('admin.files.form.title.placeholder')" />
            </UFormField>
            <UFormField :label="t('admin.files.form.description.label')" name="description">
              <UTextarea v-model="form.description" class="w-full" :placeholder="t('admin.files.form.description.placeholder')" :rows="3" />
            </UFormField>
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
              <UFormField :label="t('admin.upload.fields.captureTime.label')" name="captureTime" class="flex-1">
                <UInput v-model="captureTimeLocal" class="w-full" type="datetime-local" step="1" :placeholder="t('admin.upload.fields.captureTime.placeholder')" />
                <template #description>
                  <span class="text-xs">{{ t('admin.upload.fields.captureTime.description') }}</span>
                </template>
              </UFormField>
              <UFormField :label="t('admin.files.form.genre.label')" name="genre" class="flex-1">
                <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div class="flex-1 min-w-0">
                    <USelect
                      v-model="form.genre"
                      class="w-full"
                      :items="genreOptions"
                      value-attribute="value"
                      option-attribute="label"
                      :placeholder="t('admin.files.form.genre.placeholder')"
                    />
                  </div>
                  <UButton
                    variant="soft"
                    color="primary"
                    class="w-full whitespace-nowrap sm:w-auto sm:shrink-0"
                    :disabled="!canAutoClassify"
                    :loading="classifyingGenre"
                    @click="autoClassifyGenre"
                  >
                    <template #leading>
                      <LoadingIcon :loading="classifyingGenre" icon="mdi:robot-outline" />
                    </template>
                    <span class="hidden sm:inline">{{ t('admin.files.form.genre.auto') }}</span>
                  </UButton>
                </div>
                <template #description>
                  <span class="text-xs text-muted">{{ t('admin.files.form.genre.autoDescription') }}</span>
                </template>
              </UFormField>
            </div>
          </div>
          <div :class="baseGrid">
            <UFormField :label="t('admin.upload.fields.width.label')" name="width" :description="t('admin.upload.fields.width.description')" :class="thirdCol">
              <UInput v-model.number="form.width" class="w-full" type="number" min="1" :placeholder="t('admin.upload.fields.width.placeholder')" />
            </UFormField>
            <UFormField :label="t('admin.upload.fields.height.label')" name="height" :description="t('admin.upload.fields.height.description')" :class="thirdCol">
              <UInput v-model.number="form.height" class="w-full" type="number" min="1" :placeholder="t('admin.upload.fields.height.placeholder')" />
            </UFormField>
          </div>
        </div>
      </div>
    </section>

    <section :class="sectionCard">
      <div :class="sectionLayout">
        <div class="flex items-start gap-2 rounded-lg bg-elevated/60 px-3 py-2">
          <Icon name="mdi:map-marker-outline" class="h-4 w-4 text-primary" />
          <div>
            <p class="text-xs font-semibold uppercase tracking-wide text-muted">
              {{ t('admin.upload.formSections.location.label') }}
            </p>
            <p class="text-sm text-toned">
              {{ t('admin.upload.formSections.location.description') }}
            </p>
          </div>
        </div>
        <div class="flex w-full flex-col gap-4">
          <div class="space-y-3 rounded-xl border border-default/50 bg-elevated/70 p-3">
            <UFormField :label="t('admin.upload.fields.locationSearch.label')" name="locationSearch">
              <UInput
                v-model="geocodeQuery"
                class="w-full"
                :placeholder="t('admin.upload.fields.locationSearch.placeholder')"
                @keydown.enter.prevent="searchLocation"
              />
              <template #description>
                <span class="text-xs text-muted">{{ t('admin.upload.fields.locationSearch.placeholder') }}</span>
              </template>
            </UFormField>
            <UButton
              class="w-full justify-center md:w-auto"
              color="primary"
              :loading="geocoding"
              @click="searchLocation"
            >
              <template #leading>
                <LoadingIcon :loading="geocoding" icon="mdi:map-search-outline" />
              </template>
              <span>{{ t('admin.upload.fields.locationSearch.action') }}</span>
            </UButton>
            <div v-if="geocodeResults.length > 0" class="space-y-2 rounded-md border border-default/40 bg-default/70 p-3">
              <p class="text-xs font-semibold uppercase tracking-wide text-muted">
                {{ t('admin.upload.fields.locationSearch.resultsLabel') }}
              </p>
              <div class="grid gap-2">
                <button
                  v-for="result in geocodeResults"
                  :key="result.id"
                  type="button"
                  class="flex w-full items-start justify-between gap-3 rounded-md bg-elevated/80 p-2 text-left ring-1 ring-default/30 transition hover:bg-default/70"
                  @click="applyGeocodeResult(result)"
                >
                  <div class="space-y-0.5">
                    <p class="text-sm font-semibold text-highlighted">
                      {{ result.name }}
                    </p>
                    <p class="text-xs text-muted">
                      {{ result.placeName }}
                    </p>
                  </div>
                  <span class="text-xs font-medium text-primary">
                    {{ t('admin.upload.fields.locationSearch.apply') }}
                  </span>
                </button>
              </div>
            </div>
          </div>
          <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
            <UFormField :label="t('admin.upload.fields.latitude.label')" name="latitude" class="flex-1">
              <UInput v-model.number="form.latitude" class="w-full" type="number" step="0.000001" placeholder="39.9087" />
            </UFormField>
            <UFormField :label="t('admin.upload.fields.longitude.label')" name="longitude" class="flex-1">
              <UInput v-model.number="form.longitude" class="w-full" type="number" step="0.000001" placeholder="116.3975" />
            </UFormField>
            <div class="flex w-full items-end justify-end sm:w-auto">
              <UButton
                variant="soft"
                color="primary"
                :loading="geocoding"
                :disabled="!canReverseGeocode"
                class="w-full sm:w-auto"
                @click="searchLocation"
              >
                <template #leading>
                  <LoadingIcon :loading="geocoding" icon="mdi:map-marker-radius-outline" />
                </template>
                <span>{{ t('admin.files.form.locationReverse.actionShort') }}</span>
              </UButton>
            </div>
          </div>
          <div :class="baseGrid">
            <UFormField :label="t('admin.upload.fields.locationName.label')" name="locationName" :class="halfCol">
              <UInput v-model="form.locationName" class="w-full" :placeholder="t('admin.upload.fields.locationName.placeholder')" />
            </UFormField>
            <UFormField :label="t('admin.upload.fields.locationRaw.label')" name="locationRaw" :class="halfCol">
              <UInput v-model="form.location" class="w-full" :placeholder="t('admin.upload.fields.locationRaw.placeholder')" />
            </UFormField>
          </div>
        </div>
      </div>
    </section>

    <section :class="sectionCard">
      <div :class="sectionLayout">
        <div class="flex items-start gap-2 rounded-lg bg-elevated/60 px-3 py-2">
          <Icon name="mdi:camera-outline" class="h-4 w-4 text-primary" />
          <div>
            <p class="text-xs font-semibold uppercase tracking-wide text-muted">
              {{ t('admin.upload.formSections.camera.label') }}
            </p>
            <p class="text-sm text-toned">
              {{ t('admin.upload.formSections.camera.description') }}
            </p>
          </div>
        </div>
        <div class="flex w-full flex-col gap-4">
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div
              v-for="highlight in exposureHighlights"
              :key="highlight.label"
              class="rounded-xl border border-default/50 bg-elevated/70 p-3 text-center"
            >
              <div class="flex items-center justify-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted">
                <Icon :name="highlight.icon" class="h-4 w-4 text-primary" />
                <span>{{ highlight.label }}</span>
              </div>
              <p class="text-2xl font-semibold text-highlighted">
                {{ highlight.value }}
              </p>
            </div>
          </div>
          <div :class="baseGrid">
            <UFormField :label="t('admin.upload.fields.cameraModel.label')" name="cameraModel" :class="halfCol">
              <UInput v-model="form.cameraModel" class="w-full" :placeholder="t('admin.upload.fields.cameraModel.placeholder')" />
            </UFormField>
            <UFormField :label="t('admin.upload.fields.lensModel.label')" name="lensModel" :class="halfCol">
              <UInput v-model="form.lensModel" class="w-full" :placeholder="t('admin.upload.fields.lensModel.placeholder')" />
            </UFormField>
            <UFormField :label="t('admin.upload.fields.aperture.label')" name="aperture" :class="thirdCol">
              <UInput v-model="form.aperture" class="w-full" :placeholder="t('admin.upload.fields.aperture.placeholder')" />
            </UFormField>
            <UFormField :label="t('admin.upload.fields.shutterSpeed.label')" name="shutterSpeed" :class="thirdCol">
              <UInput v-model="form.shutterSpeed" class="w-full" :placeholder="t('admin.upload.fields.shutterSpeed.placeholder')" />
            </UFormField>
            <UFormField name="iso" label="ISO" :class="thirdCol">
              <UInput v-model="form.iso" class="w-full" placeholder="800" />
            </UFormField>
            <UFormField :label="t('admin.upload.fields.focalLength.label')" name="focalLength" :class="thirdCol">
              <UInput v-model="form.focalLength" class="w-full" :placeholder="t('admin.upload.fields.focalLength.placeholder')" />
            </UFormField>
            <UFormField :label="t('admin.upload.fields.exposureBias.label')" name="exposureBias" :class="thirdCol">
              <UInput v-model="form.exposureBias" class="w-full" :placeholder="t('admin.upload.fields.exposureBias.placeholder')" />
            </UFormField>
            <UFormField :label="t('admin.upload.fields.exposureProgram.label')" name="exposureProgram" :class="thirdCol">
              <USelect
                v-model="form.exposureProgram"
                class="w-full"
                :items="exposureProgramOptions"
                value-attribute="value"
                option-attribute="label"
                :placeholder="t('admin.upload.fields.exposureProgram.placeholder')"
              />
            </UFormField>
            <UFormField :label="t('admin.upload.fields.exposureMode.label')" name="exposureMode" :class="thirdCol">
              <USelect
                v-model="form.exposureMode"
                class="w-full"
                :items="exposureModeOptions"
                value-attribute="value"
                option-attribute="label"
                :placeholder="t('admin.upload.fields.exposureMode.placeholder')"
              />
            </UFormField>
            <UFormField :label="t('admin.upload.fields.meteringMode.label')" name="meteringMode" :class="thirdCol">
              <USelect
                v-model="form.meteringMode"
                class="w-full"
                :items="meteringModeOptions"
                value-attribute="value"
                option-attribute="label"
                :placeholder="t('admin.upload.fields.meteringMode.placeholder')"
              />
            </UFormField>
            <UFormField :label="t('admin.upload.fields.whiteBalance.label')" name="whiteBalance" :class="thirdCol">
              <USelect
                v-model="form.whiteBalance"
                class="w-full"
                :items="whiteBalanceOptions"
                value-attribute="value"
                option-attribute="label"
                :placeholder="t('admin.upload.fields.whiteBalance.placeholder')"
              />
            </UFormField>
            <UFormField :label="t('admin.upload.fields.flash.label')" name="flash" :class="thirdCol">
              <USelect
                v-model="form.flash"
                class="w-full"
                :items="flashOptions"
                value-attribute="value"
                option-attribute="label"
                :placeholder="t('admin.upload.fields.flash.placeholder')"
              />
            </UFormField>
          </div>
        </div>
      </div>
    </section>

    <section :class="sectionCard">
      <div :class="sectionLayout">
        <div class="flex items-start gap-2 rounded-lg bg-elevated/60 px-3 py-2">
          <Icon name="mdi:palette-outline" class="h-4 w-4 text-primary" />
          <div>
            <p class="text-xs font-semibold uppercase tracking-wide text-muted">
              {{ t('admin.upload.formSections.color.label') }}
            </p>
            <p class="text-sm text-toned">
              {{ t('admin.upload.formSections.color.description') }}
            </p>
          </div>
        </div>
        <div class="w-full">
          <div :class="baseGrid">
            <UFormField :label="t('admin.upload.fields.colorSpace.label')" name="colorSpace" :class="halfCol">
              <UInput v-model="form.colorSpace" class="w-full" :placeholder="t('admin.upload.fields.colorSpace.placeholder')" />
            </UFormField>
            <UFormField :label="t('admin.upload.fields.resolutionUnit.label')" name="resolutionUnit" :class="halfCol">
              <UInput v-model="form.resolutionUnit" class="w-full" :placeholder="t('admin.upload.fields.resolutionUnit.placeholder')" />
            </UFormField>
            <div class="col-span-12 grid grid-cols-2 gap-3">
              <UFormField :label="t('admin.upload.fields.resolutionX.label')" name="resolutionX">
                <UInput v-model="form.resolutionX" class="w-full" :placeholder="t('admin.upload.fields.resolutionX.placeholder')" />
              </UFormField>
              <UFormField :label="t('admin.upload.fields.resolutionY.label')" name="resolutionY">
                <UInput v-model="form.resolutionY" class="w-full" :placeholder="t('admin.upload.fields.resolutionY.placeholder')" />
              </UFormField>
            </div>
            <UFormField :label="t('admin.upload.fields.software.label')" name="software" class="col-span-12">
              <UInput v-model="form.software" class="w-full" :placeholder="t('admin.upload.fields.software.placeholder')" />
            </UFormField>
          </div>
        </div>
      </div>
    </section>
  </section>
</template>
