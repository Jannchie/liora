<script setup lang="ts">
import type { FileResponse } from '~/types/file'
import type { SeriesDetail, SeriesSummary } from '~/types/series'
import { useVirtualList } from '@vueuse/core'
import { computed, reactive, ref, watch } from 'vue'

const { t } = useI18n()
definePageMeta({
  layout: 'admin',
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
  <div>
    <UPageHeader
      :title="t('admin.series.title')"
      :description="t('admin.series.seoDescription')"
    >
      <template #actions>
        <UButton color="primary" size="sm" icon="jannchie:plus" @click="createModalOpen = true">
          {{ t('admin.series.create.action') }}
        </UButton>
      </template>
    </UPageHeader>

    <div v-if="isLoading" class="wire-band py-16 text-center text-[13px] text-dimmed">
      {{ t('common.loading') }}
    </div>

    <!-- Master/detail: the list column's right hairline is the only divider
         between the two panes, so they sit flush with no gutter. -->
    <div v-else class="grid lg:grid-cols-[260px_minmax(0,1fr)]">
      <!-- LEFT · MASTER LIST — sticky and self-scrolling like the admin
           sidebar, so a long series list never drags the detail along. -->
      <aside class="border-border max-lg:border-b lg:sticky lg:top-[var(--admin-header-h)] lg:h-[calc(100vh-var(--admin-header-h))] lg:self-start lg:overflow-y-auto lg:border-r">
        <div class="px-2.5 pb-10 pt-5">
          <p class="label-caption px-2.5 pb-2.5">
            {{ t('admin.series.listTitle') }} · <span class="num-tabular">{{ seriesList.length }}</span>
          </p>
          <div class="flex flex-col gap-px">
            <button
              v-for="item in seriesList"
              :key="item.id"
              type="button"
              class="group flex w-full items-center gap-2.5 rounded-md px-2.5 py-[5px] text-left text-[13.5px] outline-none transition-colors focus-visible:shadow-[var(--ring-focus)]"
              :class="item.id === selectedSeriesId
                ? 'bg-muted text-highlighted'
                : 'text-muted hover:bg-muted hover:text-fg-highlighted'"
              @click="selectSeries(item)"
            >
              <div class="h-6 w-8 shrink-0 overflow-hidden bg-sunken">
                <img
                  v-if="item.cover?.imageUrl"
                  :src="item.cover.imageUrl"
                  :alt="item.title"
                  loading="lazy"
                  class="h-full w-full object-cover"
                >
              </div>
              <span class="min-w-0 flex-1 truncate">{{ item.title }}</span>
              <span class="num-tabular shrink-0 text-xs text-dimmed">{{ item.fileCount }}</span>
            </button>
          </div>
          <p v-if="seriesList.length === 0" class="px-2.5 py-6 text-center text-[13px] text-dimmed">
            —
          </p>
        </div>
      </aside>

      <!-- RIGHT · DETAIL — a stack of bands, each closed by its own hairline. -->
      <section v-if="selectedSeries" class="min-w-0">
        <!-- HERO -->
        <header class="wire-band flex flex-col gap-6 sm:flex-row sm:items-start">
          <div class="aspect-[4/3] w-full max-w-[220px] shrink-0 overflow-hidden bg-sunken">
            <img
              v-if="selectedSeries.cover?.imageUrl"
              :src="selectedSeries.cover.imageUrl"
              :alt="selectedSeries.title"
              loading="lazy"
              class="h-full w-full object-cover"
            >
            <div v-else class="flex h-full w-full items-center justify-center text-dimmed">
              <Icon name="jannchie:image-off" class="h-6 w-6" />
            </div>
          </div>
          <div class="flex min-w-0 flex-1 flex-col gap-3 self-stretch">
            <div class="space-y-1.5">
              <p class="label-caption">
                {{ t('admin.series.edit.title') }}
              </p>
              <h2 class="break-words text-xl font-semibold leading-tight tracking-[-0.01em] text-highlighted">
                {{ selectedSeries.title }}
              </h2>
              <p class="text-xs text-dimmed">
                <span class="font-mono">/{{ selectedSeriesSlug || selectedSeries.slug }}</span> · <span class="num-tabular">{{ formatCountLabel(selectedSeries.fileCount) }}</span>
              </p>
            </div>
            <p v-if="selectedSeries.description" class="max-w-2xl text-[13px] leading-relaxed text-dimmed">
              {{ selectedSeries.description }}
            </p>
            <div class="mt-auto flex items-center gap-1.5 pt-2">
              <UButton color="primary" size="sm" :loading="saving" icon="jannchie:save" @click="saveSeries">
                {{ t('common.actions.save') }}
              </UButton>
              <UButton color="neutral" variant="ghost" size="sm" :loading="deleting" icon="jannchie:trash" class="hover:text-error" @click="deleteSeries">
                {{ t('common.actions.delete') }}
              </UButton>
            </div>
          </div>
        </header>

        <!-- METADATA -->
        <USection
          panel
          label="Metadata"
          icon="jannchie:edit"
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
          panel
          label="Files"
          icon="jannchie:image-edit"
        >
          <template #actions>
            <UButton color="neutral" variant="ghost" size="sm" :loading="syncingOrder" icon="jannchie:sort-ascending" @click="saveOrder">
              {{ t('admin.series.files.saveOrder') }}
            </UButton>
          </template>

          <div class="space-y-3">
            <UInput
              v-model="addQuery"
              class="w-full"
              :placeholder="t('admin.series.files.searchPlaceholder')"
              icon="jannchie:search"
            />

            <!-- One frame split by a single vertical hairline; rows are
                 ruled instead of floating in sunken wells. -->
            <div class="grid overflow-hidden rounded-lg border border-border divide-border max-lg:divide-y lg:grid-cols-2 lg:divide-x">
              <!-- CANDIDATES -->
              <div class="min-w-0">
                <div class="flex items-center justify-between border-b border-border px-3 py-2">
                  <p class="label-caption">
                    Candidates
                  </p>
                  <span class="num-tabular text-xs text-dimmed">{{ filteredCandidates.length }}</span>
                </div>
                <p v-if="filteredCandidates.length === 0" class="py-10 text-center text-[13px] text-dimmed">
                  {{ t('admin.series.files.noCandidate') }}
                </p>
                <div
                  v-else
                  v-bind="candidatesContainerProps"
                  class="h-[28rem]"
                >
                  <div v-bind="candidatesWrapperProps">
                    <div
                      v-for="entry in virtualCandidates"
                      :key="entry.data.id"
                      class="flex h-14 items-center gap-3 border-border px-3 transition-colors hover:bg-muted"
                      :class="entry.index === filteredCandidates.length - 1 ? '' : 'border-b'"
                    >
                      <div class="h-10 w-14 shrink-0 overflow-hidden bg-sunken">
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
                        <p class="truncate text-[13px] text-highlighted">
                          {{ entry.data.title || entry.data.originalName || `#${entry.data.id}` }}
                        </p>
                        <p class="font-mono text-xs text-dimmed">
                          #{{ entry.data.id }}
                        </p>
                      </div>
                      <UButton size="xs" variant="ghost" color="neutral" icon="jannchie:plus" class="shrink-0" :aria-label="t('common.actions.add')" @click="addFile(entry.data.id)" />
                    </div>
                  </div>
                </div>
              </div>

              <!-- IN SERIES (ORDERED) -->
              <div class="min-w-0">
                <div class="flex items-center justify-between border-b border-border px-3 py-2">
                  <p class="label-caption">
                    In series
                  </p>
                  <span class="num-tabular text-xs text-dimmed">{{ selectedFileIds.length }}</span>
                </div>
                <p v-if="detailLoading" class="py-10 text-center text-[13px] text-dimmed">
                  {{ t('common.loading') }}
                </p>
                <p v-else-if="selectedFileIds.length === 0" class="py-10 text-center text-[13px] text-dimmed">
                  {{ t('admin.series.files.empty') }}
                </p>
                <div
                  v-else
                  v-bind="inSeriesContainerProps"
                  class="h-[28rem]"
                >
                  <div v-bind="inSeriesWrapperProps">
                    <div
                      v-for="entry in virtualInSeries"
                      :key="entry.data.id"
                      class="flex h-14 items-center gap-3 border-border px-3 transition-colors hover:bg-muted"
                      :class="entry.index === selectedFileIds.length - 1 ? '' : 'border-b'"
                    >
                      <span class="num-tabular w-6 shrink-0 text-center text-xs text-dimmed">{{ entry.index + 1 }}</span>
                      <div class="h-10 w-14 shrink-0 overflow-hidden bg-sunken">
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
                        <p class="truncate text-[13px] text-highlighted">
                          {{ entry.data.file?.title || entry.data.file?.originalName || `#${entry.data.id}` }}
                        </p>
                        <p class="font-mono text-xs text-dimmed">
                          #{{ entry.data.id }}
                        </p>
                      </div>
                      <div class="flex shrink-0 items-center gap-0.5">
                        <UButton size="xs" variant="ghost" color="neutral" icon="jannchie:arrow-up" :disabled="entry.index === 0" @click="moveFile(entry.data.id, -1)" />
                        <UButton size="xs" variant="ghost" color="neutral" icon="jannchie:arrow-down" :disabled="entry.index === selectedFileIds.length - 1" @click="moveFile(entry.data.id, 1)" />
                        <UButton size="xs" variant="ghost" color="neutral" icon="jannchie:x" class="hover:text-error" @click="removeFile(entry.data.id)" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </USection>
      </section>

      <section v-else class="flex min-h-[40vh] items-center justify-center text-[13px] text-dimmed">
        —
      </section>
    </div>

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
      </div>
      <!-- Footer bleeds to the modal edges so its top hairline spans the
           full width, mirroring the header's bottom rule. -->
      <div class="-mx-5 -mb-5 mt-5 flex justify-end gap-2 border-t border-border px-5 py-3">
        <UButton variant="ghost" color="neutral" @click="createModalOpen = false">
          {{ t('common.actions.cancel') }}
        </UButton>
        <UButton color="primary" :loading="creating" icon="jannchie:plus" @click="createSeries">
          {{ t('admin.series.create.action') }}
        </UButton>
      </div>
    </UModal>
  </div>
</template>
