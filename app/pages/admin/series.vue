<script setup lang="ts">
import type { FileResponse } from '~/types/file'
import type { SeriesDetail, SeriesSummary } from '~/types/series'
import { computed, reactive, ref, watch } from 'vue'

const { t } = useI18n()
definePageMeta({
  middleware: 'admin-auth',
})

const toast = useToast()
async function refreshSeriesApiCaches(): Promise<void> {
  await clearNuxtData()
  await refreshNuxtData()
}

const pageTitle = computed(() => t('admin.series.seoTitle'))
const pageDescription = computed(() => t('admin.series.seoDescription'))

useSeoMeta({
  title: () => pageTitle.value,
  ogTitle: () => pageTitle.value,
  description: () => pageDescription.value,
  ogDescription: () => pageDescription.value,
  robots: 'noindex, nofollow',
})

const { data: seriesData, pending: pendingSeries, error: seriesError, refresh: refreshSeries } = useFetch<SeriesSummary[]>('/api/series', {
  default: () => [],
  server: false,
})

const { data: filesData, pending: pendingFiles, error: filesError } = useFetch<FileResponse[]>('/api/files', {
  default: () => [],
  server: false,
})

const seriesList = computed(() => (seriesData.value ?? []).filter(item => !item.isVirtual))
const allFiles = computed(() => filesData.value ?? [])
const allFilesById = computed(() => new Map(allFiles.value.map(file => [file.id, file])))
const isLoading = computed(() => pendingSeries.value || pendingFiles.value)

const selectedSeriesId = ref<number | null>(null)
const selectedSeriesSlug = ref('')
const detailLoading = ref(false)
const creating = ref(false)
const saving = ref(false)
const deleting = ref(false)
const syncingOrder = ref(false)
const addQuery = ref('')

const selectedFileIds = ref<number[]>([])

const createForm = reactive({
  title: '',
  slug: '',
  description: '',
})

const editForm = reactive({
  title: '',
  slug: '',
  description: '',
  coverFileId: null as number | null,
})

const coverFileIdModel = computed<number | undefined>({
  get: () => editForm.coverFileId ?? undefined,
  set: (value) => {
    editForm.coverFileId = value ?? null
  },
})

const selectedSeries = computed(() => seriesList.value.find(item => item.id === selectedSeriesId.value) ?? null)
const selectedFileIdSet = computed(() => new Set(selectedFileIds.value))

const coverOptions = computed(() => selectedFileIds.value.map((fileId) => {
  const file = allFilesById.value.get(fileId)
  const title = file?.title?.trim() || file?.originalName?.trim() || `#${fileId}`
  return {
    label: `#${fileId} ${title}`,
    value: fileId,
  }
}))

const filteredCandidates = computed(() => {
  const query = addQuery.value.trim().toLowerCase()
  const available = allFiles.value.filter(file => !selectedFileIdSet.value.has(file.id))
  if (!query) {
    return available.slice(0, 24)
  }
  return available
    .filter((file) => {
      const title = file.title?.toLowerCase() ?? ''
      const originalName = file.originalName?.toLowerCase() ?? ''
      return title.includes(query) || originalName.includes(query) || String(file.id).includes(query)
    })
    .slice(0, 24)
})

function formatCountLabel(value: number): string {
  return t('admin.series.count', { count: value })
}

function resetCreateForm(): void {
  createForm.title = ''
  createForm.slug = ''
  createForm.description = ''
}

function applySeriesToEditForm(value: SeriesSummary): void {
  editForm.title = value.title
  editForm.slug = value.slug
  editForm.description = value.description
  editForm.coverFileId = value.coverFileId
}

async function loadSeriesDetail(slug: string): Promise<void> {
  detailLoading.value = true
  try {
    const detail = await $fetch<SeriesDetail>(`/api/series/by-slug/${encodeURIComponent(slug)}`, {
      query: {
        limit: 2000,
        offset: 0,
      },
    })
    selectedFileIds.value = detail.files.map(file => file.id)
    editForm.coverFileId = detail.coverFileId
  }
  catch (error) {
    selectedFileIds.value = []
    const message = error instanceof Error ? error.message : t('admin.series.toast.loadFailedFallback')
    toast.add({ title: t('admin.series.toast.loadFailed'), description: message, color: 'error' })
  }
  finally {
    detailLoading.value = false
  }
}

async function selectSeries(item: SeriesSummary): Promise<void> {
  selectedSeriesId.value = item.id
  selectedSeriesSlug.value = item.slug
  applySeriesToEditForm(item)
  await loadSeriesDetail(item.slug)
}

watch(
  seriesList,
  (items) => {
    if (items.length === 0) {
      selectedSeriesId.value = null
      selectedSeriesSlug.value = ''
      selectedFileIds.value = []
      return
    }
    const current = items.find(item => item.id === selectedSeriesId.value)
    if (current) {
      applySeriesToEditForm(current)
      selectedSeriesSlug.value = current.slug
      return
    }
    const first = items[0]
    if (first) {
      void selectSeries(first)
    }
  },
  { immediate: true },
)

async function createSeries(): Promise<void> {
  const title = createForm.title.trim()
  if (!title) {
    toast.add({ title: t('admin.series.toast.titleRequired'), color: 'warning' })
    return
  }

  creating.value = true
  try {
    const created = await $fetch<SeriesSummary>('/api/series', {
      method: 'POST',
      body: {
        title,
        slug: createForm.slug.trim() || undefined,
        description: createForm.description,
      },
    })
    await refreshSeries()
    resetCreateForm()
    const next = seriesList.value.find(item => item.id === created.id)
    if (next) {
      await selectSeries(next)
    }
    await refreshSeriesApiCaches()
    toast.add({ title: t('admin.series.toast.createSuccess'), color: 'success' })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : t('admin.series.toast.createFailedFallback')
    toast.add({ title: t('admin.series.toast.createFailed'), description: message, color: 'error' })
  }
  finally {
    creating.value = false
  }
}

async function saveSeries(): Promise<void> {
  const seriesId = selectedSeriesId.value
  if (!seriesId) {
    return
  }

  saving.value = true
  try {
    const updated = await $fetch<SeriesSummary>(`/api/series/${seriesId}`, {
      method: 'PUT',
      body: {
        title: editForm.title,
        slug: editForm.slug,
        description: editForm.description,
        coverFileId: editForm.coverFileId,
      },
    })
    await refreshSeries()
    selectedSeriesSlug.value = updated.slug
    await refreshSeriesApiCaches()
    toast.add({ title: t('admin.series.toast.updateSuccess'), color: 'success' })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : t('admin.series.toast.updateFailedFallback')
    toast.add({ title: t('admin.series.toast.updateFailed'), description: message, color: 'error' })
  }
  finally {
    saving.value = false
  }
}

async function deleteSeries(): Promise<void> {
  const seriesId = selectedSeriesId.value
  if (!seriesId) {
    return
  }

  deleting.value = true
  try {
    await $fetch(`/api/series/${seriesId}`, {
      method: 'DELETE',
    })
    selectedSeriesId.value = null
    selectedSeriesSlug.value = ''
    selectedFileIds.value = []
    await refreshSeries()
    await refreshSeriesApiCaches()
    toast.add({ title: t('admin.series.toast.deleteSuccess'), color: 'success' })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : t('admin.series.toast.deleteFailedFallback')
    toast.add({ title: t('admin.series.toast.deleteFailed'), description: message, color: 'error' })
  }
  finally {
    deleting.value = false
  }
}

async function addFile(fileId: number): Promise<void> {
  const seriesId = selectedSeriesId.value
  if (!seriesId) {
    return
  }

  try {
    await $fetch(`/api/series/${seriesId}/files`, {
      method: 'POST',
      body: {
        fileIds: [fileId],
      },
    })
    selectedFileIds.value = [...selectedFileIds.value, fileId]
    if (editForm.coverFileId === null) {
      editForm.coverFileId = fileId
    }
    await refreshSeries()
    await refreshSeriesApiCaches()
  }
  catch (error) {
    const message = error instanceof Error ? error.message : t('admin.series.toast.addFileFailedFallback')
    toast.add({ title: t('admin.series.toast.addFileFailed'), description: message, color: 'error' })
  }
}

async function removeFile(fileId: number): Promise<void> {
  const seriesId = selectedSeriesId.value
  if (!seriesId) {
    return
  }
  try {
    await $fetch(`/api/series/${seriesId}/files/${fileId}`, {
      method: 'DELETE',
    })
    selectedFileIds.value = selectedFileIds.value.filter(id => id !== fileId)
    if (editForm.coverFileId === fileId) {
      editForm.coverFileId = null
    }
    await refreshSeries()
    await refreshSeriesApiCaches()
  }
  catch (error) {
    const message = error instanceof Error ? error.message : t('admin.series.toast.removeFileFailedFallback')
    toast.add({ title: t('admin.series.toast.removeFileFailed'), description: message, color: 'error' })
  }
}

function moveFile(fileId: number, direction: -1 | 1): void {
  const index = selectedFileIds.value.indexOf(fileId)
  if (index === -1) {
    return
  }
  const nextIndex = index + direction
  if (nextIndex < 0 || nextIndex >= selectedFileIds.value.length) {
    return
  }
  const next = [...selectedFileIds.value]
  const [item] = next.splice(index, 1)
  if (typeof item !== 'number') {
    return
  }
  next.splice(nextIndex, 0, item)
  selectedFileIds.value = next
}

async function saveOrder(): Promise<void> {
  const seriesId = selectedSeriesId.value
  if (!seriesId) {
    return
  }
  syncingOrder.value = true
  try {
    await $fetch(`/api/series/${seriesId}/reorder`, {
      method: 'PUT',
      body: {
        items: selectedFileIds.value.map((fileId, index) => ({
          fileId,
          sortOrder: index + 1,
        })),
      },
    })
    await refreshSeries()
    await refreshSeriesApiCaches()
    toast.add({ title: t('admin.series.toast.reorderSuccess'), color: 'success' })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : t('admin.series.toast.reorderFailedFallback')
    toast.add({ title: t('admin.series.toast.reorderFailed'), description: message, color: 'error' })
  }
  finally {
    syncingOrder.value = false
  }
}

watch(seriesError, (value) => {
  if (!value) {
    return
  }
  toast.add({ title: t('admin.series.toast.loadFailed'), description: value.message, color: 'error' })
})

watch(filesError, (value) => {
  if (!value) {
    return
  }
  toast.add({ title: t('admin.series.toast.loadFilesFailed'), description: value.message, color: 'error' })
})
</script>

<template>
  <div class="min-h-screen">
    <UContainer class="space-y-8 py-10">
      <AdminNav />

      <header class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="flex items-center gap-2 text-3xl font-semibold">
            <Icon name="tabler:stack-3" class="h-6 w-6 text-primary" />
            <span>{{ t('admin.series.title') }}</span>
          </h1>
        </div>
      </header>

      <div v-if="isLoading" class="py-10 text-center text-sm text-muted">
        {{ t('common.loading') }}
      </div>

      <div v-else class="grid gap-6 xl:grid-cols-[320px,1fr]">
        <section class="space-y-4 rounded-xl border border-default/40 bg-default/80 p-4">
          <h2 class="text-sm font-semibold text-highlighted">
            {{ t('admin.series.create.title') }}
          </h2>
          <UFormField :label="t('admin.series.form.title')">
            <UInput v-model="createForm.title" :placeholder="t('admin.series.form.titlePlaceholder')" />
          </UFormField>
          <UFormField :label="t('admin.series.form.slug')">
            <UInput v-model="createForm.slug" :placeholder="t('admin.series.form.slugPlaceholder')" />
          </UFormField>
          <UFormField :label="t('admin.series.form.description')">
            <UTextarea v-model="createForm.description" :rows="3" :placeholder="t('admin.series.form.descriptionPlaceholder')" />
          </UFormField>
          <UButton color="primary" :loading="creating" icon="tabler:plus" @click="createSeries">
            {{ t('admin.series.create.action') }}
          </UButton>

          <UDivider />

          <h2 class="text-sm font-semibold text-highlighted">
            {{ t('admin.series.listTitle') }}
          </h2>
          <div class="max-h-120 space-y-2 overflow-auto pr-1">
            <button
              v-for="item in seriesList"
              :key="item.id"
              type="button"
              class="w-full rounded-lg border px-3 py-2 text-left transition"
              :class="item.id === selectedSeriesId ? 'border-primary bg-primary/10' : 'border-default/40 hover:border-primary/40'"
              @click="selectSeries(item)"
            >
              <p class="text-sm font-medium text-highlighted">
                {{ item.title }}
              </p>
              <p class="text-xs text-muted">
                {{ formatCountLabel(item.fileCount) }}
              </p>
            </button>
          </div>
        </section>

        <section v-if="selectedSeries" class="space-y-5 rounded-xl border border-default/40 bg-default/80 p-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 class="text-lg font-semibold text-highlighted">
              {{ t('admin.series.edit.title') }}
            </h2>
            <div class="flex items-center gap-2">
              <UButton color="primary" :loading="saving" icon="tabler:device-floppy" @click="saveSeries">
                {{ t('common.actions.save') }}
              </UButton>
              <UButton color="error" variant="soft" :loading="deleting" icon="tabler:trash" @click="deleteSeries">
                {{ t('common.actions.delete') }}
              </UButton>
            </div>
          </div>

          <div class="grid gap-3 lg:grid-cols-2">
            <UFormField :label="t('admin.series.form.title')">
              <UInput v-model="editForm.title" :placeholder="t('admin.series.form.titlePlaceholder')" />
            </UFormField>
            <UFormField :label="t('admin.series.form.slug')">
              <UInput v-model="editForm.slug" :placeholder="t('admin.series.form.slugPlaceholder')" />
            </UFormField>
          </div>

          <UFormField :label="t('admin.series.form.description')">
            <UTextarea v-model="editForm.description" :rows="3" :placeholder="t('admin.series.form.descriptionPlaceholder')" />
          </UFormField>

          <UFormField :label="t('admin.series.form.cover')">
            <USelect
              v-model="coverFileIdModel"
              :items="coverOptions"
              value-attribute="value"
              option-attribute="label"
              :placeholder="t('admin.series.form.coverPlaceholder')"
            />
          </UFormField>

          <UDivider />

          <div class="space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <h3 class="text-sm font-semibold text-highlighted">
                {{ t('admin.series.files.title') }}
              </h3>
              <UButton color="primary" variant="soft" :loading="syncingOrder" icon="tabler:sort-ascending" @click="saveOrder">
                {{ t('admin.series.files.saveOrder') }}
              </UButton>
            </div>

            <UInput
              v-model="addQuery"
              :placeholder="t('admin.series.files.searchPlaceholder')"
              icon="tabler:search"
            />

            <div class="grid gap-2 rounded-lg border border-default/40 p-2">
              <div
                v-for="file in filteredCandidates"
                :key="file.id"
                class="flex items-center justify-between gap-2 rounded-md border border-default/30 px-2 py-1"
              >
                <div class="min-w-0">
                  <p class="truncate text-sm text-highlighted">
                    {{ file.title || file.originalName || `#${file.id}` }}
                  </p>
                  <p class="text-xs text-muted">
                    #{{ file.id }}
                  </p>
                </div>
                <UButton size="xs" color="primary" variant="soft" icon="tabler:plus" @click="addFile(file.id)">
                  {{ t('common.actions.add') }}
                </UButton>
              </div>
              <p v-if="filteredCandidates.length === 0" class="text-xs text-muted">
                {{ t('admin.series.files.noCandidate') }}
              </p>
            </div>

            <div class="space-y-2 rounded-lg border border-default/40 p-2">
              <div
                v-for="(fileId, index) in selectedFileIds"
                :key="fileId"
                class="flex items-center justify-between gap-2 rounded-md border border-default/30 px-2 py-1"
              >
                <div class="min-w-0">
                  <p class="truncate text-sm text-highlighted">
                    {{ allFilesById.get(fileId)?.title || allFilesById.get(fileId)?.originalName || `#${fileId}` }}
                  </p>
                  <p class="text-xs text-muted">
                    #{{ fileId }}
                  </p>
                </div>
                <div class="flex items-center gap-1">
                  <UButton size="xs" variant="ghost" color="neutral" icon="tabler:arrow-up" :disabled="index === 0" @click="moveFile(fileId, -1)" />
                  <UButton size="xs" variant="ghost" color="neutral" icon="tabler:arrow-down" :disabled="index === selectedFileIds.length - 1" @click="moveFile(fileId, 1)" />
                  <UButton size="xs" variant="soft" color="error" icon="tabler:x" @click="removeFile(fileId)" />
                </div>
              </div>
              <p v-if="detailLoading" class="text-xs text-muted">
                {{ t('common.loading') }}
              </p>
              <p v-if="!detailLoading && selectedFileIds.length === 0" class="text-xs text-muted">
                {{ t('admin.series.files.empty') }}
              </p>
            </div>
          </div>
        </section>
      </div>
    </UContainer>
  </div>
</template>
