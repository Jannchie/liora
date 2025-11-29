<script setup lang="ts">
import type { ImageSizes } from '@nuxt/image'
import type { MediaFormState } from '~/types/admin'
import type { FileResponse } from '~/types/file'
import { computed, reactive, ref, watch } from 'vue'
import { useFileEditApi } from '~/composables/useFileEditApi'
import { toLocalInputString } from '~/utils/datetime'

const { t } = useI18n()
definePageMeta({
  middleware: 'admin-auth',
})

const toast = useToast()
const image = useImage()
const { updateFile } = useFileEditApi()

const pageTitle = computed(() => t('admin.files.seoTitle'))
const pageDescription = computed(() => t('admin.files.seoDescription'))
const toastMessages = computed(() => ({
  updateSuccess: t('admin.files.toast.updateSuccess'),
  updateSuccessDescription: t('admin.files.toast.updateSuccessDescription'),
  updateFailed: t('admin.files.toast.updateFailed'),
  deleteSuccess: t('admin.files.toast.deleteSuccess'),
  deleteSuccessDescription: t('admin.files.toast.deleteSuccessDescription'),
  deleteFailed: t('admin.files.toast.deleteFailed'),
  loadFailed: t('common.toast.loadFailed'),
  updateFailedFallback: t('admin.files.toast.updateFailedFallback'),
  deleteFailedFallback: t('admin.files.toast.deleteFailedFallback'),
  classifySuccess: t('admin.files.toast.classifySuccess'),
  classifyFailed: t('admin.files.toast.classifyFailed'),
  classifyFailedFallback: t('admin.files.toast.classifyFailedFallback'),
  classifySummary: t('admin.files.toast.classifySummary'),
}))

useSeoMeta({
  title: () => pageTitle.value,
  ogTitle: () => pageTitle.value,
  description: () => pageDescription.value,
  ogDescription: () => pageDescription.value,
  robots: 'noindex, nofollow',
})

const { data: filesData, pending: pendingFiles, refresh, error: fetchError } = await useFetch<FileResponse[]>('/api/files', {
  default: () => [],
})

const files = computed<FileResponse[]>(() => filesData.value ?? [])
const isLoading = computed(() => pendingFiles.value)

const page = ref(1)
const pageSize = ref(10)
type SortKey = 'title' | 'captureTime' | 'createdAt'
type SortDirection = 'asc' | 'desc'
const sortKey = ref<SortKey>('createdAt')
const sortDirection = ref<SortDirection>('desc')

const totalFiles = computed(() => files.value.length)
const pageCount = computed(() => Math.max(1, Math.ceil(totalFiles.value / pageSize.value)))
const sortedFiles = computed<FileResponse[]>(() => {
  const direction = sortDirection.value === 'asc' ? 1 : -1
  const compare = (a: FileResponse, b: FileResponse): number => {
    const aValue = sortAccessor(a, sortKey.value)
    const bValue = sortAccessor(b, sortKey.value)
    const comparison = compareValues(aValue, bValue)
    return comparison * direction
  }
  const sortableArray = files.value as FileResponse[] & { toSorted?: typeof Array.prototype.toSorted }
  if (typeof sortableArray.toSorted === 'function') {
    return sortableArray.toSorted(compare)
  }
  const result: FileResponse[] = []
  for (const item of files.value) {
    const insertIndex = result.findIndex(existing => compare(item, existing) < 0)
    if (insertIndex === -1) {
      result.push(item)
    }
    else {
      result.splice(insertIndex, 0, item)
    }
  }
  return result
})
const paginatedFiles = computed<FileResponse[]>(() => {
  const start = (page.value - 1) * pageSize.value
  return sortedFiles.value.slice(start, start + pageSize.value)
})
const recordCountText = computed(() => t('common.labels.recordCount', { count: totalFiles.value }))
const paginationText = computed(() => t('common.labels.pageIndicator', { page: page.value, pageCount: pageCount.value }))
const tableEmptyText = computed(() => t('admin.files.table.empty'))
const untitledLabel = computed(() => t('common.labels.untitled'))
const unknownLabel = computed(() => t('common.labels.unknown'))
const tableUi = computed(() => ({
  wrapper: 'relative overflow-visible',
  table: 'min-w-0 w-full table-auto',
  th: 'text-left text-sm font-semibold text-muted',
  td: 'align-middle whitespace-normal break-words',
}))

watch(
  () => totalFiles.value,
  (count) => {
    const maxPage = Math.max(1, Math.ceil(count / pageSize.value))
    if (page.value > maxPage) {
      page.value = maxPage
    }
  },
  { immediate: true },
)

const tableColumns = computed(() => [
  { id: 'preview', header: t('admin.files.table.headers.preview'), accessorFn: (row: FileResponse) => row.imageUrl },
  { accessorKey: 'title', id: 'title', header: t('admin.files.table.headers.title') },
  { id: 'captureTime', header: t('admin.files.table.headers.captureTime'), accessorFn: (row: FileResponse) => row.metadata.captureTime || row.createdAt },
  { accessorKey: 'createdAt', id: 'createdAt', header: t('admin.files.table.headers.createdAt') },
  { id: 'actions', header: t('admin.files.table.headers.actions'), accessorFn: (row: FileResponse) => row.id },
])

function resolvePreviewUrl(file: FileResponse): string {
  const primary = file.imageUrl.trim()
  if (primary) {
    return primary
  }
  return file.thumbnailUrl.trim() || file.imageUrl
}

type ImageAttributes = ImageSizes & {
  src: string
  width?: number
  height?: number
}

function resolvePreviewImage(file: FileResponse): ImageAttributes {
  const source = resolvePreviewUrl(file)
  const modifiers = {
    width: 192,
    height: 112,
    format: 'webp',
    fit: 'cover',
  }
  const sizes = image.getSizes(source, {
    modifiers,
    sizes: '160px',
  })
  const resolvedSrc
    = sizes.src
    ?? image.getImage(source, {
      modifiers,
    }).url
  return {
    ...sizes,
    src: resolvedSrc,
    width: 192,
    height: 112,
  }
}

function normalizeDate(value: string | undefined): number | undefined {
  if (!value) {
    return undefined
  }
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? undefined : parsed
}

function sortAccessor(file: FileResponse, key: SortKey): string | number | undefined {
  if (key === 'title') {
    return file.title?.toLowerCase() ?? ''
  }
  if (key === 'captureTime') {
    return normalizeDate(file.metadata.captureTime || file.createdAt)
  }
  return normalizeDate(file.createdAt)
}

function compareValues(a: string | number | undefined, b: string | number | undefined): number {
  if (a === b) {
    return 0
  }
  if (a === undefined) {
    return 1
  }
  if (b === undefined) {
    return -1
  }
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b
  }
  return String(a).localeCompare(String(b))
}

function handleSort(column: SortKey): void {
  if (sortKey.value === column) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  }
  else {
    sortKey.value = column
    sortDirection.value = column === 'title' ? 'asc' : 'desc'
  }
  page.value = 1
}

function resolveSortIcon(column: SortKey): string {
  if (sortKey.value !== column) {
    return 'mdi:swap-vertical'
  }
  return sortDirection.value === 'asc' ? 'mdi:arrow-up' : 'mdi:arrow-down'
}

function resolveAriaSort(column: SortKey): 'ascending' | 'descending' | 'none' {
  if (sortKey.value !== column) {
    return 'none'
  }
  return sortDirection.value === 'asc' ? 'ascending' : 'descending'
}

function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return date.toLocaleString()
}

type EditableForm = MediaFormState

const editForm = reactive<EditableForm>({
  title: '',
  description: '',
  genre: '',
  width: 0,
  height: 0,
  fanworkTitle: '',
  characters: [],
  location: '',
  locationName: '',
  latitude: null,
  longitude: null,
  cameraModel: '',
  lensModel: '',
  aperture: '',
  focalLength: '',
  iso: '',
  shutterSpeed: '',
  exposureBias: '',
  exposureProgram: '',
  exposureMode: '',
  meteringMode: '',
  whiteBalance: '',
  flash: '',
  colorSpace: '',
  resolutionX: '',
  resolutionY: '',
  resolutionUnit: '',
  software: '',
  captureTime: '',
  notes: '',
})
const editFormModel = computed<EditableForm>({
  get: () => editForm,
  set: (value) => {
    Object.assign(editForm, value)
  },
})

const editCaptureTimeLocal = ref<string>('')
const editingFile = ref<FileResponse | null>(null)
const editModalOpen = ref(false)
const updating = ref(false)
const replaceFile = ref<File | null>(null)
function resetEditForm(): void {
  editForm.title = ''
  editForm.description = ''
  editForm.genre = ''
  editForm.width = 0
  editForm.height = 0
  editForm.fanworkTitle = ''
  editForm.characters = []
  editForm.location = ''
  editForm.locationName = ''
  editForm.latitude = null
  editForm.longitude = null
  editForm.cameraModel = ''
  editForm.lensModel = ''
  editForm.aperture = ''
  editForm.focalLength = ''
  editForm.iso = ''
  editForm.shutterSpeed = ''
  editForm.exposureBias = ''
  editForm.exposureProgram = ''
  editForm.exposureMode = ''
  editForm.meteringMode = ''
  editForm.whiteBalance = ''
  editForm.flash = ''
  editForm.colorSpace = ''
  editForm.resolutionX = ''
  editForm.resolutionY = ''
  editForm.resolutionUnit = ''
  editForm.software = ''
  editForm.captureTime = ''
  editCaptureTimeLocal.value = ''
  editForm.notes = ''
  replaceFile.value = null
}

function fillEditForm(file: FileResponse): void {
  const metadata = file.metadata
  editForm.title = file.title ?? ''
  editForm.description = file.description ?? ''
  editForm.width = file.width
  editForm.height = file.height
  editForm.genre = file.genre || ''
  editForm.fanworkTitle = metadata.fanworkTitle || file.fanworkTitle || ''
  editForm.characters = metadata.characters ?? file.characters ?? []
  editForm.location = metadata.location || file.location || ''
  editForm.locationName = metadata.locationName
  editForm.latitude = metadata.latitude
  editForm.longitude = metadata.longitude
  editForm.cameraModel = metadata.cameraModel || file.cameraModel || ''
  editForm.lensModel = metadata.lensModel || ''
  editForm.aperture = metadata.aperture || ''
  editForm.focalLength = metadata.focalLength || ''
  editForm.iso = metadata.iso || ''
  editForm.shutterSpeed = metadata.shutterSpeed || ''
  editForm.exposureBias = metadata.exposureBias || ''
  editForm.exposureProgram = metadata.exposureProgram || ''
  editForm.exposureMode = metadata.exposureMode || ''
  editForm.meteringMode = metadata.meteringMode || ''
  editForm.whiteBalance = metadata.whiteBalance || ''
  editForm.flash = metadata.flash || ''
  editForm.colorSpace = metadata.colorSpace || ''
  editForm.resolutionX = metadata.resolutionX || ''
  editForm.resolutionY = metadata.resolutionY || ''
  editForm.resolutionUnit = metadata.resolutionUnit || ''
  editForm.software = metadata.software || ''
  editForm.captureTime = metadata.captureTime || ''
  editCaptureTimeLocal.value = editForm.captureTime ? toLocalInputString(editForm.captureTime) : ''
  editForm.notes = metadata.notes || ''
}

function closeEdit(): void {
  editModalOpen.value = false
  editingFile.value = null
  resetEditForm()
}

async function saveEdit(): Promise<void> {
  if (!editingFile.value) {
    return
  }
  updating.value = true
  try {
    const updated = await updateFile(
      editingFile.value.id,
      editForm,
      replaceFile.value,
      editingFile.value.width,
      editingFile.value.height,
    )
    filesData.value = filesData.value?.map(file => (file.id === updated.id ? updated : file)) ?? []
    toast.add({ title: toastMessages.value.updateSuccess, description: toastMessages.value.updateSuccessDescription, color: 'primary' })
    closeEdit()
  }
  catch (error) {
    const message = error instanceof Error ? error.message : toastMessages.value.updateFailedFallback
    toast.add({ title: toastMessages.value.updateFailed, description: message, color: 'error' })
  }
  finally {
    updating.value = false
  }
}

function openEdit(file: FileResponse): void {
  editingFile.value = file
  fillEditForm(file)
  editModalOpen.value = true
}
const deletingId = ref<number | null>(null)
const deleteTarget = ref<FileResponse | null>(null)
const deleteModalOpen = ref(false)
const reclassifying = ref(false)
const hasFiles = computed(() => files.value.length > 0)

interface ReclassifySummary {
  total: number
  updated: number
  skipped: number
  failed: number
}

async function reclassifyMissing(): Promise<void> {
  if (reclassifying.value) {
    return
  }
  reclassifying.value = true
  try {
    const summary = await $fetch<ReclassifySummary>('/api/files/reclassify', { method: 'POST' })
    await refresh()
    if (summary.failed > 0) {
      toast.add({
        title: toastMessages.value.classifyFailed,
        description: toastMessages.value.classifyFailedFallback || undefined,
        color: 'warning',
      })
    }
  }
  catch (error) {
    const message = error instanceof Error ? error.message : toastMessages.value.classifyFailedFallback
    toast.add({ title: toastMessages.value.classifyFailed, description: message, color: 'error' })
  }
  finally {
    reclassifying.value = false
  }
}

function openDelete(file: FileResponse): void {
  deleteTarget.value = file
  deleteModalOpen.value = true
}

async function confirmDelete(): Promise<void> {
  if (!deleteTarget.value) {
    return
  }
  deletingId.value = deleteTarget.value.id
  try {
    await $fetch(`/api/files/${deleteTarget.value.id}`, { method: 'DELETE' })
    filesData.value = filesData.value?.filter(item => item.id !== deleteTarget.value?.id) ?? []
    deleteModalOpen.value = false
  }
  catch (error) {
    const message = error instanceof Error ? error.message : toastMessages.value.deleteFailedFallback
    toast.add({ title: toastMessages.value.deleteFailed, description: message, color: 'error' })
  }
  finally {
    deletingId.value = null
  }
}

async function handleRefresh(): Promise<void> {
  await refresh()
  page.value = 1
}

watch(fetchError, (value) => {
  if (value) {
    toast.add({ title: toastMessages.value.loadFailed, description: value.message, color: 'error' })
  }
})
</script>

<template>
  <div class="min-h-screen">
    <UContainer class="space-y-8 py-10">
      <AdminNav />

      <header class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="flex items-center gap-2 text-3xl font-semibold">
            <Icon name="mdi:view-list-outline" class="h-6 w-6 text-primary" />
            <span>{{ t('admin.files.title') }}</span>
          </h1>
        </div>
        <div class="flex items-center gap-2">
          <UButton to="/admin/upload" variant="soft" color="primary">
            <span class="flex items-center gap-2">
              <Icon name="mdi:upload-outline" class="h-4 w-4" />
              <span>{{ t('admin.files.actions.toUpload') }}</span>
            </span>
          </UButton>
          <UButton
            color="primary"
            variant="soft"
            :disabled="!hasFiles || reclassifying"
            :loading="reclassifying"
            :ui="{ spinner: 'hidden' }"
            @click="reclassifyMissing"
          >
            <span class="flex items-center gap-2">
              <LoadingIcon :loading="reclassifying" icon="mdi:magic-wand" />
              <span>{{ t('admin.files.actions.reclassify') }}</span>
            </span>
          </UButton>
          <UButton
            color="primary"
            variant="solid"
            :loading="isLoading"
            :ui="{ spinner: 'hidden' }"
            @click="handleRefresh"
          >
            <span class="flex items-center gap-2">
              <LoadingIcon :loading="isLoading" icon="mdi:refresh" />
              <span>{{ t('admin.files.actions.refresh') }}</span>
            </span>
          </UButton>
        </div>
      </header>

      <section class="space-y-3">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="flex items-center gap-2 text-xl font-semibold">
              <Icon name="mdi:table" class="h-5 w-5 text-primary" />
              <span>{{ t('admin.files.section.title') }}</span>
            </h2>
          </div>
          <div class="flex items-center gap-2 text-sm text-muted">
            <Icon name="mdi:counter" class="h-4 w-4" />
            <span>{{ recordCountText }}</span>
          </div>
        </div>
        <div class="rounded-xl bg-default/80 p-4">
          <UTable
            :columns="tableColumns"
            :data="paginatedFiles"
            :loading="isLoading"
            :empty="tableEmptyText"
            :ui="tableUi"
          >
            <template #title-header>
              <button
                type="button"
                class="flex items-center gap-1 text-left text-sm font-semibold text-toned transition hover:text-primary"
                :aria-sort="resolveAriaSort('title')"
                @click="handleSort('title')"
              >
                <span>{{ t('admin.files.table.headers.title') }}</span>
                <Icon :name="resolveSortIcon('title')" class="h-4 w-4 text-muted" />
              </button>
            </template>
            <template #captureTime-header>
              <button
                type="button"
                class="flex items-center gap-1 text-left text-sm font-semibold text-toned transition hover:text-primary"
                :aria-sort="resolveAriaSort('captureTime')"
                @click="handleSort('captureTime')"
              >
                <span>{{ t('admin.files.table.headers.captureTime') }}</span>
                <Icon :name="resolveSortIcon('captureTime')" class="h-4 w-4 text-muted" />
              </button>
            </template>
            <template #createdAt-header>
              <button
                type="button"
                class="flex items-center gap-1 text-left text-sm font-semibold text-toned transition hover:text-primary"
                :aria-sort="resolveAriaSort('createdAt')"
                @click="handleSort('createdAt')"
              >
                <span>{{ t('admin.files.table.headers.createdAt') }}</span>
                <Icon :name="resolveSortIcon('createdAt')" class="h-4 w-4 text-muted" />
              </button>
            </template>
            <template #preview-cell="{ row }">
              <div class="h-14 w-24 overflow-hidden rounded-md bg-black/5">
                <img
                  :key="row.original.id"
                  :alt="row.original.title || untitledLabel"
                  loading="lazy"
                  class="h-full w-full object-cover"
                  v-bind="resolvePreviewImage(row.original)"
                >
              </div>
            </template>
            <template #title-cell="{ row }">
              <div class="space-y-1">
                <p class="font-medium leading-tight">
                  {{ row.original.title || untitledLabel }}
                </p>
                <p v-if="row.original.description" class="text-xs text-muted line-clamp-2">
                  {{ row.original.description }}
                </p>
              </div>
            </template>
            <template #captureTime-cell="{ row }">
              <span class="text-sm text-toned">
                {{ formatDateTime(row.original.metadata.captureTime || row.original.createdAt) || unknownLabel }}
              </span>
            </template>
            <template #createdAt-cell="{ row }">
              <span class="text-sm text-toned">
                {{ formatDateTime(row.original.createdAt) }}
              </span>
            </template>
            <template #actions-cell="{ row }">
              <div class="flex flex-wrap items-center gap-2">
                <UButton size="xs" variant="soft" color="primary" @click="openEdit(row.original)">
                  <span class="flex items-center gap-1.5">
                    <Icon name="mdi:pencil-outline" class="h-4 w-4" />
                    <span>{{ t('common.actions.edit') }}</span>
                  </span>
                </UButton>
                <UButton
                  size="xs"
                  variant="soft"
                  color="error"
                  :loading="deletingId === row.original.id"
                  :ui="{ spinner: 'hidden' }"
                  @click="openDelete(row.original)"
                >
                  <span class="flex items-center gap-1.5">
                    <LoadingIcon :loading="deletingId === row.original.id" icon="mdi:trash-can-outline" />
                    <span>{{ t('common.actions.delete') }}</span>
                  </span>
                </UButton>
              </div>
            </template>
          </UTable>
          <div class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div class="text-sm text-muted">
              {{ paginationText }}
            </div>
            <UPagination v-model:page="page" :items-per-page="pageSize" :total="totalFiles" />
          </div>
        </div>
      </section>
    </UContainer>

    <AdminEditModal
      v-model:open="editModalOpen"
      v-model:form="editFormModel"
      v-model:capture-time-local="editCaptureTimeLocal"
      v-model:replace-file="replaceFile"
      :file="editingFile"
      :loading="updating"
      :classify-source="{ imageUrl: editingFile?.imageUrl || '' }"
      @submit="saveEdit"
      @close="closeEdit"
    />
    <UModal v-model:open="deleteModalOpen">
      <template #content>
        <div class="w-full max-w-xl space-y-4 rounded-xl bg-default/90 p-4 backdrop-blur">
          <div class="flex items-start justify-between">
            <div class="space-y-1">
              <p class="text-sm text-error">
                {{ t('admin.files.delete.title') }}
              </p>
              <h3 class="text-lg font-semibold">
                {{ t('admin.files.delete.heading') }}
              </h3>
              <p class="text-xs text-muted">
                {{ t('admin.files.delete.description') }}
              </p>
            </div>
            <UButton variant="soft" color="neutral" @click="deleteModalOpen = false">
              <span class="flex items-center gap-1.5">
                <Icon name="mdi:close" class="h-4 w-4" />
                <span>{{ t('common.actions.close') }}</span>
              </span>
            </UButton>
          </div>
          <div class="space-y-3">
            <p class="text-sm">
              {{ t('admin.files.delete.titleLabel') }}<span class="font-medium">{{ deleteTarget?.title || untitledLabel }}</span>
            </p>
            <p class="text-sm text-toned">
              {{ t('admin.files.delete.createdAtLabel') }}{{ deleteTarget ? formatDateTime(deleteTarget.createdAt) : '' }}
            </p>
          </div>
          <div class="flex justify-end gap-2">
            <UButton variant="soft" color="neutral" @click="deleteModalOpen = false">
              <span class="flex items-center gap-1.5">
                <Icon name="mdi:arrow-left" class="h-4 w-4" />
                <span>{{ t('common.actions.cancel') }}</span>
              </span>
            </UButton>
            <UButton
              color="error"
              :loading="deletingId !== null"
              :ui="{ spinner: 'hidden' }"
              @click="confirmDelete"
            >
              <span class="flex items-center gap-1.5">
                <LoadingIcon :loading="deletingId !== null" icon="mdi:trash-can-outline" />
                <span>{{ t('admin.files.delete.confirm') }}</span>
              </span>
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
