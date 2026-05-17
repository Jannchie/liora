<script setup lang="ts">
import type { FileResponse } from '~/types/file'
import type { SeriesDetail, SeriesSummary } from '~/types/series'
import { useVirtualList } from '@vueuse/core'
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
const createModalOpen = ref(false)

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
    return available
  }
  return available.filter((file) => {
    const title = file.title?.toLowerCase() ?? ''
    const originalName = file.originalName?.toLowerCase() ?? ''
    return title.includes(query) || originalName.includes(query) || String(file.id).includes(query)
  })
})

const inSeriesFiles = computed<Array<{ id: number, file: FileResponse | undefined }>>(() =>
  selectedFileIds.value.map(id => ({ id, file: allFilesById.value.get(id) })),
)

// Fixed row height keeps useVirtualList math trivial and prevents layout jitter
// when content varies. h-14 = 56px; matches img h-10 + py-2 (16px).
const ROW_HEIGHT = 56

const { list: virtualCandidates, containerProps: candidatesContainerProps, wrapperProps: candidatesWrapperProps } = useVirtualList(filteredCandidates, {
  itemHeight: ROW_HEIGHT,
  overscan: 6,
})

const { list: virtualInSeries, containerProps: inSeriesContainerProps, wrapperProps: inSeriesWrapperProps } = useVirtualList(inSeriesFiles, {
  itemHeight: ROW_HEIGHT,
  overscan: 6,
})

// Low-res thumbnails — rendered ~56px wide on screen, so 112px source covers
// 2× DPR. webp + fit:cover keeps payload small on the busy list view.
const image = useImage()
function resolveThumbnailSrc(url: string | undefined | null): string {
  const source = (url ?? '').trim()
  if (!source) {
    return ''
  }
  return image.getImage(source, {
    modifiers: { width: 112, height: 80, format: 'webp', fit: 'cover' },
  }).url
}

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
    createModalOpen.value = false
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
    <UContainer class="space-y-10 py-10">
      <AdminNav />

      <UPageHeader
        :eyebrow="t('admin.nav.label')"
        icon="tabler:shield-check"
        :title="t('admin.series.title')"
        :description="t('admin.series.seoDescription')"
      >
        <template #actions>
          <UButton color="primary" size="sm" icon="tabler:plus" @click="createModalOpen = true">
            {{ t('admin.series.create.action') }}
          </UButton>
        </template>
      </UPageHeader>

      <div v-if="isLoading" class="py-10 text-center text-sm text-muted">
        {{ t('common.loading') }}
      </div>

      <div v-else class="grid gap-x-10 gap-y-10 lg:grid-cols-[260px,1fr]">
        <!-- LEFT · MASTER LIST -->
        <aside class="lg:border-r lg:border-[var(--color-border-muted)] lg:pr-8">
          <div class="flex items-baseline justify-between pb-3">
            <p class="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
              {{ t('admin.series.listTitle') }}
            </p>
            <span class="font-mono text-[11px] text-muted">{{ seriesList.length }}</span>
          </div>
          <div class="-mx-3 max-h-[calc(100vh-260px)] overflow-auto">
            <button
              v-for="item in seriesList"
              :key="item.id"
              type="button"
              class="group flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[var(--color-muted)]"
              :class="item.id === selectedSeriesId
                ? 'border-l-2 border-l-[var(--color-primary)] bg-[var(--color-primary-soft)]/40'
                : 'border-l-2 border-l-transparent'"
              @click="selectSeries(item)"
            >
              <div class="h-9 w-12 shrink-0 overflow-hidden bg-[var(--color-muted)]">
                <img
                  v-if="item.cover?.imageUrl"
                  :src="item.cover.imageUrl"
                  :alt="item.title"
                  loading="lazy"
                  class="h-full w-full object-cover"
                >
              </div>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium text-highlighted">
                  {{ item.title }}
                </p>
                <p class="truncate font-mono text-[11px] text-muted">
                  /{{ item.slug }} · {{ item.fileCount }}
                </p>
              </div>
            </button>
            <p v-if="seriesList.length === 0" class="px-3 py-6 text-center text-xs text-muted">
              —
            </p>
          </div>
        </aside>

        <!-- RIGHT · DETAIL -->
        <section v-if="selectedSeries" class="space-y-10">
          <!-- HERO -->
          <header class="flex flex-col gap-6 sm:flex-row sm:items-start">
            <div class="aspect-[4/3] w-full max-w-[260px] shrink-0 overflow-hidden bg-[var(--color-muted)]">
              <img
                v-if="selectedSeries.cover?.imageUrl"
                :src="selectedSeries.cover.imageUrl"
                :alt="selectedSeries.title"
                loading="lazy"
                class="h-full w-full object-cover"
              >
              <div v-else class="flex h-full w-full items-center justify-center text-muted">
                <Icon name="tabler:photo-off" class="h-8 w-8" />
              </div>
            </div>
            <div class="flex min-w-0 flex-1 flex-col gap-3">
              <div class="space-y-1">
                <p class="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                  {{ t('admin.series.edit.title') }}
                </p>
                <h2 class="break-words text-3xl font-semibold leading-tight text-highlighted">
                  {{ selectedSeries.title }}
                </h2>
                <p class="font-mono text-xs text-muted">
                  /{{ selectedSeriesSlug || selectedSeries.slug }} · {{ formatCountLabel(selectedSeries.fileCount) }}
                </p>
              </div>
              <p v-if="selectedSeries.description" class="max-w-2xl text-sm text-toned">
                {{ selectedSeries.description }}
              </p>
              <div class="mt-auto flex items-center gap-2 pt-2">
                <UButton color="primary" size="sm" :loading="saving" icon="tabler:device-floppy" @click="saveSeries">
                  {{ t('common.actions.save') }}
                </UButton>
                <UButton color="error" variant="ghost" size="sm" :loading="deleting" icon="tabler:trash" @click="deleteSeries">
                  {{ t('common.actions.delete') }}
                </UButton>
              </div>
            </div>
          </header>

          <!-- METADATA -->
          <USection
            label="Metadata"
            icon="tabler:edit"
          >
            <div class="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <UFormField :label="t('admin.series.form.title')">
                <UInput v-model="editForm.title" class="w-full" :placeholder="t('admin.series.form.titlePlaceholder')" />
              </UFormField>
              <UFormField :label="t('admin.series.form.slug')">
                <UInput v-model="editForm.slug" class="w-full" :placeholder="t('admin.series.form.slugPlaceholder')" />
              </UFormField>
              <UFormField :label="t('admin.series.form.description')" class="sm:col-span-2">
                <UTextarea v-model="editForm.description" class="w-full" :rows="3" :placeholder="t('admin.series.form.descriptionPlaceholder')" />
              </UFormField>
              <UFormField :label="t('admin.series.form.cover')" class="sm:col-span-2">
                <USelect
                  v-model="coverFileIdModel"
                  class="w-full"
                  :items="coverOptions"
                  value-attribute="value"
                  option-attribute="label"
                  :placeholder="t('admin.series.form.coverPlaceholder')"
                />
              </UFormField>
            </div>
          </USection>

          <!-- FILES · two-pane manager -->
          <USection
            label="Files"
            icon="tabler:photo-edit"
          >
            <template #actions>
              <UButton color="primary" variant="ghost" size="sm" :loading="syncingOrder" icon="tabler:sort-ascending" @click="saveOrder">
                {{ t('admin.series.files.saveOrder') }}
              </UButton>
            </template>

            <div class="space-y-4">
              <UInput
                v-model="addQuery"
                class="w-full"
                :placeholder="t('admin.series.files.searchPlaceholder')"
                icon="tabler:search"
              />

              <div class="grid gap-x-8 gap-y-6 lg:grid-cols-2">
                <!-- CANDIDATES -->
                <div class="space-y-2">
                  <div class="flex items-baseline justify-between pb-1">
                    <p class="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                      Candidates
                    </p>
                    <span class="font-mono text-[11px] text-muted">{{ filteredCandidates.length }}</span>
                  </div>
                  <p v-if="filteredCandidates.length === 0" class="border-t border-[var(--color-border-muted)] py-6 text-center text-xs text-muted">
                    {{ t('admin.series.files.noCandidate') }}
                  </p>
                  <div
                    v-else
                    v-bind="candidatesContainerProps"
                    class="h-[28rem] border-t border-[var(--color-border-muted)]"
                  >
                    <div v-bind="candidatesWrapperProps">
                      <div
                        v-for="entry in virtualCandidates"
                        :key="entry.data.id"
                        class="group flex h-14 items-center gap-3 border-b border-[var(--color-border-muted)]"
                      >
                        <div class="h-10 w-14 shrink-0 overflow-hidden bg-[var(--color-muted)]">
                          <img
                            v-if="entry.data.imageUrl"
                            :src="resolveThumbnailSrc(entry.data.imageUrl)"
                            :alt="entry.data.title || entry.data.originalName || `#${entry.data.id}`"
                            width="112"
                            height="80"
                            loading="lazy"
                            decoding="async"
                            class="h-full w-full object-cover"
                          >
                        </div>
                        <div class="min-w-0 flex-1">
                          <p class="truncate text-sm text-highlighted">
                            {{ entry.data.title || entry.data.originalName || `#${entry.data.id}` }}
                          </p>
                          <p class="font-mono text-[11px] text-muted">
                            #{{ entry.data.id }}
                          </p>
                        </div>
                        <UButton size="xs" variant="ghost" color="primary" icon="tabler:plus" class="shrink-0" :aria-label="t('common.actions.add')" @click="addFile(entry.data.id)" />
                      </div>
                    </div>
                  </div>
                </div>

                <!-- IN SERIES (ORDERED) -->
                <div class="space-y-2">
                  <div class="flex items-baseline justify-between pb-1">
                    <p class="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                      In series
                    </p>
                    <span class="font-mono text-[11px] text-muted">{{ selectedFileIds.length }}</span>
                  </div>
                  <p v-if="detailLoading" class="border-t border-[var(--color-border-muted)] py-6 text-center text-xs text-muted">
                    {{ t('common.loading') }}
                  </p>
                  <p v-else-if="selectedFileIds.length === 0" class="border-t border-[var(--color-border-muted)] py-6 text-center text-xs text-muted">
                    {{ t('admin.series.files.empty') }}
                  </p>
                  <div
                    v-else
                    v-bind="inSeriesContainerProps"
                    class="h-[28rem] border-t border-[var(--color-border-muted)]"
                  >
                    <div v-bind="inSeriesWrapperProps">
                      <div
                        v-for="entry in virtualInSeries"
                        :key="entry.data.id"
                        class="flex h-14 items-center gap-3 border-b border-[var(--color-border-muted)]"
                      >
                        <span class="w-6 shrink-0 text-center font-mono text-[11px] text-muted">{{ entry.index + 1 }}</span>
                        <div class="h-10 w-14 shrink-0 overflow-hidden bg-[var(--color-muted)]">
                          <img
                            v-if="entry.data.file?.imageUrl"
                            :src="resolveThumbnailSrc(entry.data.file.imageUrl)"
                            :alt="entry.data.file.title || `#${entry.data.id}`"
                            width="112"
                            height="80"
                            loading="lazy"
                            decoding="async"
                            class="h-full w-full object-cover"
                          >
                        </div>
                        <div class="min-w-0 flex-1">
                          <p class="truncate text-sm text-highlighted">
                            {{ entry.data.file?.title || entry.data.file?.originalName || `#${entry.data.id}` }}
                          </p>
                          <p class="font-mono text-[11px] text-muted">
                            #{{ entry.data.id }}
                          </p>
                        </div>
                        <div class="flex shrink-0 items-center gap-0.5">
                          <UButton size="xs" variant="ghost" color="neutral" icon="tabler:arrow-up" :disabled="entry.index === 0" @click="moveFile(entry.data.id, -1)" />
                          <UButton size="xs" variant="ghost" color="neutral" icon="tabler:arrow-down" :disabled="entry.index === selectedFileIds.length - 1" @click="moveFile(entry.data.id, 1)" />
                          <UButton size="xs" variant="ghost" color="error" icon="tabler:x" @click="removeFile(entry.data.id)" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </USection>
        </section>

        <section v-else class="flex items-center justify-center py-20 text-sm text-muted">
          <div class="space-y-2 text-center">
            <Icon name="tabler:stack-3" class="mx-auto h-8 w-8 text-muted" />
            <p>—</p>
          </div>
        </section>
      </div>
    </UContainer>

    <!-- CREATE SERIES MODAL -->
    <UModal
      v-model:open="createModalOpen"
      size="md"
      :title="t('admin.series.create.title')"
    >
      <div class="space-y-4">
        <UFormField :label="t('admin.series.form.title')">
          <UInput v-model="createForm.title" class="w-full" :placeholder="t('admin.series.form.titlePlaceholder')" />
        </UFormField>
        <UFormField :label="t('admin.series.form.slug')">
          <UInput v-model="createForm.slug" class="w-full" :placeholder="t('admin.series.form.slugPlaceholder')" />
        </UFormField>
        <UFormField :label="t('admin.series.form.description')">
          <UTextarea v-model="createForm.description" class="w-full" :rows="3" :placeholder="t('admin.series.form.descriptionPlaceholder')" />
        </UFormField>
        <div class="flex justify-end gap-2 border-t border-[var(--color-border-muted)] pt-3">
          <UButton variant="ghost" color="neutral" @click="createModalOpen = false">
            {{ t('common.actions.cancel') }}
          </UButton>
          <UButton color="primary" :loading="creating" icon="tabler:plus" @click="createSeries">
            {{ t('admin.series.create.action') }}
          </UButton>
        </div>
      </div>
    </UModal>
  </div>
</template>
