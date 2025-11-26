<script setup lang="ts">
import type { MediaFormState } from '~/types/admin'
import { computed, watch } from 'vue'
import { useExposureOptions } from '~/composables/useExposureOptions'
import { useLocationSearch } from '~/composables/useLocationSearch'
import { toIsoWithOffset } from '~/utils/datetime'

const form = defineModel<MediaFormState>('form', { required: true })
const captureTimeLocal = defineModel<string>('captureTimeLocal', { required: true })
const charactersText = defineModel<string | undefined>('charactersText', { required: false })

const { t } = useI18n()
const {
  exposureProgramOptions,
  exposureModeOptions,
  meteringModeOptions,
  whiteBalanceOptions,
  flashOptions,
} = useExposureOptions()
const { geocodeQuery, geocoding, geocodeResults, searchLocation, applyGeocodeResult } = useLocationSearch(form.value)

const baseGrid = computed(() => 'grid grid-cols-12 gap-3')
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
  <section class="space-y-4">
    <section class="space-y-3 rounded-xl bg-default/70 p-4 shadow-sm backdrop-blur">
      <div class="flex items-center gap-2">
        <Icon name="mdi:shape-outline" class="h-4 w-4 text-primary" />
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-muted">
            基本信息
          </p>
          <p class="text-sm text-toned">
            尺寸、时间与标题描述
          </p>
        </div>
      </div>
      <div :class="baseGrid">
        <UFormField :label="t('admin.upload.fields.width.label')" name="width" :description="t('admin.upload.fields.width.description')" :class="thirdCol">
          <UInput v-model.number="form.width" type="number" min="1" :placeholder="t('admin.upload.fields.width.placeholder')" />
        </UFormField>
        <UFormField :label="t('admin.upload.fields.height.label')" name="height" :description="t('admin.upload.fields.height.description')" :class="thirdCol">
          <UInput v-model.number="form.height" type="number" min="1" :placeholder="t('admin.upload.fields.height.placeholder')" />
        </UFormField>
        <UFormField :label="t('admin.files.form.genre.label')" name="genre" :class="thirdCol">
          <USelect
            v-model="form.genre"
            :items="genreOptions"
            value-attribute="value"
            option-attribute="label"
            :placeholder="t('admin.files.form.genre.placeholder')"
          />
        </UFormField>
        <UFormField :label="t('admin.upload.fields.captureTime.label')" name="captureTime" class="col-span-12">
          <UInput v-model="captureTimeLocal" type="datetime-local" step="1" :placeholder="t('admin.upload.fields.captureTime.placeholder')" />
          <template #description>
            <span class="text-xs">{{ t('admin.upload.fields.captureTime.description') }}</span>
          </template>
        </UFormField>
        <UFormField :label="t('admin.files.form.title.label')" name="title" :class="thirdCol">
          <UInput v-model="form.title" :placeholder="t('admin.files.form.title.placeholder')" />
        </UFormField>
        <UFormField :label="t('admin.files.form.description.label')" name="description" class="col-span-12">
          <UTextarea v-model="form.description" :placeholder="t('admin.files.form.description.placeholder')" :rows="3" />
        </UFormField>
      </div>
    </section>

    <section class="space-y-3 rounded-xl bg-default/70 p-4 shadow-sm backdrop-blur">
      <div class="flex items-center gap-2">
        <Icon name="mdi:account-music-outline" class="h-4 w-4 text-primary" />
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-muted">
            作品归属
          </p>
          <p class="text-sm text-toned">
            同人、角色与说明
          </p>
        </div>
      </div>
      <div :class="baseGrid">
        <UFormField :label="t('admin.files.form.fanworkTitle.label')" name="fanworkTitle" :class="halfCol">
          <UInput v-model="form.fanworkTitle" :placeholder="t('admin.files.form.fanworkTitle.placeholder')" />
        </UFormField>
        <UFormField :label="t('admin.files.form.characters.label')" name="characters" class="col-span-12">
          <UTextarea v-model="charactersText" :rows="2" :placeholder="t('admin.files.form.characters.placeholder')" />
        </UFormField>
      </div>
    </section>

    <section class="space-y-3 rounded-xl bg-default/70 p-4 shadow-sm backdrop-blur">
      <div class="flex items-center gap-2">
        <Icon name="mdi:camera-outline" class="h-4 w-4 text-primary" />
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-muted">
            拍摄参数
          </p>
          <p class="text-sm text-toned">
            机身、镜头与曝光设定
          </p>
        </div>
      </div>
      <div :class="baseGrid">
        <UFormField :label="t('admin.upload.fields.cameraModel.label')" name="cameraModel" :class="halfCol">
          <UInput v-model="form.cameraModel" :placeholder="t('admin.upload.fields.cameraModel.placeholder')" />
        </UFormField>
        <UFormField :label="t('admin.upload.fields.lensModel.label')" name="lensModel" :class="halfCol">
          <UInput v-model="form.lensModel" :placeholder="t('admin.upload.fields.lensModel.placeholder')" />
        </UFormField>
        <UFormField :label="t('admin.upload.fields.aperture.label')" name="aperture" :class="thirdCol">
          <UInput v-model="form.aperture" :placeholder="t('admin.upload.fields.aperture.placeholder')" />
        </UFormField>
        <UFormField :label="t('admin.upload.fields.shutterSpeed.label')" name="shutterSpeed" :class="thirdCol">
          <UInput v-model="form.shutterSpeed" :placeholder="t('admin.upload.fields.shutterSpeed.placeholder')" />
        </UFormField>
        <UFormField name="iso" label="ISO" :class="thirdCol">
          <UInput v-model="form.iso" placeholder="800" />
        </UFormField>
        <UFormField :label="t('admin.upload.fields.focalLength.label')" name="focalLength" :class="thirdCol">
          <UInput v-model="form.focalLength" :placeholder="t('admin.upload.fields.focalLength.placeholder')" />
        </UFormField>
        <UFormField :label="t('admin.upload.fields.exposureBias.label')" name="exposureBias" :class="thirdCol">
          <UInput v-model="form.exposureBias" :placeholder="t('admin.upload.fields.exposureBias.placeholder')" />
        </UFormField>
        <UFormField :label="t('admin.upload.fields.exposureProgram.label')" name="exposureProgram" :class="thirdCol">
          <USelect
            v-model="form.exposureProgram"
            :items="exposureProgramOptions"
            value-attribute="value"
            option-attribute="label"
            :placeholder="t('admin.upload.fields.exposureProgram.placeholder')"
          />
        </UFormField>
        <UFormField :label="t('admin.upload.fields.exposureMode.label')" name="exposureMode" :class="thirdCol">
          <USelect
            v-model="form.exposureMode"
            :items="exposureModeOptions"
            value-attribute="value"
            option-attribute="label"
            :placeholder="t('admin.upload.fields.exposureMode.placeholder')"
          />
        </UFormField>
        <UFormField :label="t('admin.upload.fields.meteringMode.label')" name="meteringMode" :class="thirdCol">
          <USelect
            v-model="form.meteringMode"
            :items="meteringModeOptions"
            value-attribute="value"
            option-attribute="label"
            :placeholder="t('admin.upload.fields.meteringMode.placeholder')"
          />
        </UFormField>
        <UFormField :label="t('admin.upload.fields.whiteBalance.label')" name="whiteBalance" :class="thirdCol">
          <USelect
            v-model="form.whiteBalance"
            :items="whiteBalanceOptions"
            value-attribute="value"
            option-attribute="label"
            :placeholder="t('admin.upload.fields.whiteBalance.placeholder')"
          />
        </UFormField>
        <UFormField :label="t('admin.upload.fields.flash.label')" name="flash" :class="thirdCol">
          <USelect
            v-model="form.flash"
            :items="flashOptions"
            value-attribute="value"
            option-attribute="label"
            :placeholder="t('admin.upload.fields.flash.placeholder')"
          />
        </UFormField>
      </div>
    </section>

    <section class="space-y-3 rounded-xl bg-default/70 p-4 shadow-sm backdrop-blur">
      <div class="flex items-center gap-2">
        <Icon name="mdi:palette-outline" class="h-4 w-4 text-primary" />
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-muted">
            输出与色彩
          </p>
          <p class="text-sm text-toned">
            色彩空间与分辨率
          </p>
        </div>
      </div>
      <div :class="baseGrid">
        <UFormField :label="t('admin.upload.fields.colorSpace.label')" name="colorSpace" :class="thirdCol">
          <UInput v-model="form.colorSpace" :placeholder="t('admin.upload.fields.colorSpace.placeholder')" />
        </UFormField>
        <UFormField :label="t('admin.upload.fields.resolutionUnit.label')" name="resolutionUnit" :class="thirdCol">
          <UInput v-model="form.resolutionUnit" :placeholder="t('admin.upload.fields.resolutionUnit.placeholder')" />
        </UFormField>
        <UFormField :label="t('admin.upload.fields.resolutionX.label')" name="resolutionX" :class="thirdCol">
          <UInput v-model="form.resolutionX" :placeholder="t('admin.upload.fields.resolutionX.placeholder')" />
        </UFormField>
        <UFormField :label="t('admin.upload.fields.resolutionY.label')" name="resolutionY" :class="thirdCol">
          <UInput v-model="form.resolutionY" :placeholder="t('admin.upload.fields.resolutionY.placeholder')" />
        </UFormField>
        <UFormField :label="t('admin.upload.fields.software.label')" name="software" class="col-span-12">
          <UInput v-model="form.software" :placeholder="t('admin.upload.fields.software.placeholder')" />
        </UFormField>
      </div>
    </section>

    <section class="space-y-3 rounded-xl bg-default/70 p-4 shadow-sm backdrop-blur">
      <div class="flex items-center gap-2">
        <Icon name="mdi:map-marker-outline" class="h-4 w-4 text-primary" />
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-muted">
            位置信息
          </p>
          <p class="text-sm text-toned">
            地理标记与原始地址
          </p>
        </div>
      </div>
      <div :class="baseGrid">
        <UFormField :label="t('admin.upload.fields.locationName.label')" name="locationName" :class="halfCol">
          <UInput v-model="form.locationName" :placeholder="t('admin.upload.fields.locationName.placeholder')" />
        </UFormField>
        <UFormField :label="t('admin.upload.fields.locationRaw.label')" name="locationRaw" :class="halfCol">
          <UInput v-model="form.location" :placeholder="t('admin.upload.fields.locationRaw.placeholder')" />
        </UFormField>
      </div>
      <div :class="baseGrid">
        <UFormField class="col-span-12 md:col-span-8" :label="t('admin.upload.fields.locationSearch.label')" name="locationSearch">
          <UInput
            v-model="geocodeQuery"
            :placeholder="t('admin.upload.fields.locationSearch.placeholder')"
            @keydown.enter.prevent="searchLocation"
          />
        </UFormField>
        <div class="col-span-12 md:col-span-4 flex items-end">
          <UButton class="w-full md:w-auto" color="primary" :loading="geocoding" @click="searchLocation">
            <span class="flex w-full items-center justify-center gap-2">
              <Icon name="mdi:map-search-outline" class="h-4 w-4" />
              <span>{{ t('admin.upload.fields.locationSearch.action') }}</span>
            </span>
          </UButton>
        </div>
      </div>
      <div v-if="geocodeResults.length > 0" class="space-y-2 rounded-lg bg-muted/50 p-3 ring-1 ring-default/30">
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
            <span class="text-[11px] font-medium text-primary">
              {{ t('admin.upload.fields.locationSearch.apply') }}
            </span>
          </button>
        </div>
      </div>
      <div :class="baseGrid">
        <UFormField :label="t('admin.upload.fields.latitude.label')" name="latitude" :class="halfCol">
          <UInput v-model.number="form.latitude" type="number" step="0.000001" placeholder="39.9087" />
        </UFormField>
        <UFormField :label="t('admin.upload.fields.longitude.label')" name="longitude" :class="halfCol">
          <UInput v-model.number="form.longitude" type="number" step="0.000001" placeholder="116.3975" />
        </UFormField>
      </div>
    </section>

    <section class="space-y-3 rounded-xl bg-default/70 p-4 shadow-sm backdrop-blur">
      <div class="flex items-center gap-2">
        <Icon name="mdi:note-text-outline" class="h-4 w-4 text-primary" />
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-muted">
            附加说明
          </p>
          <p class="text-sm text-toned">
            备注信息便于后续检索
          </p>
        </div>
      </div>
      <UFormField :label="t('admin.upload.fields.notes.label')" name="notes">
        <UTextarea v-model="form.notes" :placeholder="t('admin.upload.fields.notes.placeholder')" :rows="2" />
      </UFormField>
    </section>
  </section>
</template>
