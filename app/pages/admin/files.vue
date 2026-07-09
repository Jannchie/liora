<script setup lang="ts">
import type { ImageSizes } from '@nuxt/image'
import type { MediaFormState } from '~/types/admin'
import type { BatchMetadataField, FileResponse } from '~/types/file'
import type { SeriesSummary } from '~/types/series'
import { computed, reactive, ref, watch } from 'vue'
import { useDepthMapUpload } from '~/composables/useDepthMapUpload'
import { useFileEditApi } from '~/composables/useFileEditApi'
import { toIsoWithOffset } from '~/utils/datetime'
import { createEmptyMediaFormState, fillMediaFormStateFromFile, resetMediaFormState } from '~/utils/media-form'

const { t, locale } = useI18n()
definePageMeta({
  middleware: 'admin-auth',
})

const toast = useToast()
const image = useImage()
const {
  saveFileEdit,
  updateFilesBatchMetadata,
  addFilesToSeriesBatch,
} = useFileEditApi()
const { uploadDepthMap } = useDepthMapUpload()

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
  depthSuccess: t('admin.files.toast.depthSuccess'),
  depthSuccessDescription: t('admin.files.toast.depthSuccessDescription'),
  depthFailed: t('admin.files.toast.depthFailed'),
  depthFailedFallback: t('admin.files.toast.depthFailedFallback'),
  depthBatchTitle: t('admin.files.toast.depthBatchTitle'),
  bulkNoSelection: t('admin.files.toast.bulkNoSelection'),
  bulkNoFields: t('admin.files.toast.bulkNoFields'),
  bulkMetadataSuccess: t('admin.files.toast.bulkMetadataSuccess'),
  bulkMetadataFailed: t('admin.files.toast.bulkMetadataFailed'),
  bulkSeriesSuccess: t('admin.files.toast.bulkSeriesSuccess'),
  bulkSeriesFailed: t('admin.files.toast.bulkSeriesFailed'),
  bulkFailedFallback: t('admin.files.toast.bulkFailedFallback'),
}))

useSeoMeta({
  title: () => pageTitle.value,
  ogTitle: () => pageTitle.value,
  description: () => pageDescription.value,
  ogDescription: () => pageDescription.value,
  robots: 'noindex, nofollow',
})

const { data: filesData, pending: pendingFiles, refresh, error: fetchError } = useFetch<FileResponse[]>('/api/files', {
  default: () => [],
  server: false,
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
interface DepthBatchSummary {
  total: number
  success: number
  failed: number
  skipped: number
}

interface DepthBatchProgress extends DepthBatchSummary {
  processed: number
}

const depthProcessing = reactive<Record<number, boolean>>({})
const bulkDepthProcessing = ref(false)
const batchProgress = reactive<DepthBatchProgress>({
  total: 0,
  processed: 0,
  success: 0,
  failed: 0,
  skipped: 0,
})
const showBatchProgress = computed(() => bulkDepthProcessing.value && batchProgress.total > 0)
const batchProgressPercent = computed(() => {
  if (batchProgress.total <= 0) {
    return 0
  }
  return Math.min(100, (batchProgress.processed / batchProgress.total) * 100)
})
const batchProgressLabel = computed(() => t('admin.files.batch.progress', {
  processed: batchProgress.processed,
  total: batchProgress.total,
}))
const batchProgressSummary = computed(() => t('admin.files.batch.summary', {
  success: batchProgress.success,
  failed: batchProgress.failed,
  skipped: batchProgress.skipped,
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
  { id: 'select', header: t('admin.files.table.headers.select'), accessorFn: (row: FileResponse) => row.id },
  { id: 'preview', header: t('admin.files.table.headers.preview'), accessorFn: (row: FileResponse) => row.imageUrl },
  { accessorKey: 'title', id: 'title', header: t('admin.files.table.headers.title') },
  { id: 'captureTime', header: t('admin.files.table.headers.captureTime'), accessorFn: (row: FileResponse) => row.metadata.captureTime || row.createdAt },
  { accessorKey: 'createdAt', id: 'createdAt', header: t('admin.files.table.headers.createdAt') },
  { id: 'actions', header: t('admin.files.table.headers.actions'), accessorFn: (row: FileResponse) => row.id },
])

const selectedFileIds = ref<number[]>([])
const selectedFileIdSet = computed(() => new Set(selectedFileIds.value))
const selectedCount = computed(() => selectedFileIds.value.length)
const pageFileIds = computed<number[]>(() => paginatedFiles.value.map(file => file.id))
const selectedCountOnPage = computed(() => pageFileIds.value.filter(id => selectedFileIdSet.value.has(id)).length)
const allOnPageSelected = computed(() => pageFileIds.value.length > 0 && selectedCountOnPage.value === pageFileIds.value.length)
const someOnPageSelected = computed(() => selectedCountOnPage.value > 0 && !allOnPageSelected.value)

const bulkMetadataModalOpen = ref(false)
const bulkMetadataSaving = ref(false)
const bulkMetadataForm = reactive<MediaFormState>(createEmptyMediaFormState())
const bulkMetadataCaptureTimeLocal = ref('')
const selectedBatchFields = ref<BatchMetadataField[]>([])

const bulkSeriesModalOpen = ref(false)
const bulkSeriesSaving = ref(false)
const selectedSeriesIdForBatch = ref<number | null>(null)
const selectedSeriesIdForBatchModel = computed<number | undefined>({
  get: () => selectedSeriesIdForBatch.value ?? undefined,
  set: (value) => {
    selectedSeriesIdForBatch.value = typeof value === 'number' ? value : null
  },
})
const { data: seriesOptionsData, refresh: refreshSeriesOptions } = useFetch<SeriesSummary[]>('/api/series', {
  default: () => [],
  server: false,
  immediate: false,
})

const batchEditableFields = computed<Array<{ key: BatchMetadataField, label: string }>>(() => [
  { key: 'title', label: t('admin.files.form.title.label') },
  { key: 'description', label: t('admin.files.form.description.label') },
  { key: 'genre', label: t('admin.files.form.genre.label') },
  { key: 'fanworkTitle', label: t('admin.files.form.fanworkTitle.label') },
  { key: 'characters', label: t('admin.files.form.characters.label') },
  { key: 'location', label: t('admin.files.form.location.label') },
  { key: 'locationName', label: t('admin.files.form.locationName.label') },
  { key: 'latitude', label: t('admin.files.form.latitude.label') },
  { key: 'longitude', label: t('admin.files.form.longitude.label') },
  { key: 'cameraModel', label: t('admin.files.form.cameraModel.label') },
  { key: 'lensModel', label: t('admin.upload.fields.lensModel.label') },
  { key: 'aperture', label: t('admin.upload.fields.aperture.label') },
  { key: 'focalLength', label: t('admin.upload.fields.focalLength.label') },
  { key: 'iso', label: 'ISO' },
  { key: 'shutterSpeed', label: t('admin.upload.fields.shutterSpeed.label') },
  { key: 'exposureBias', label: t('admin.upload.fields.exposureBias.label') },
  { key: 'exposureProgram', label: t('admin.upload.fields.exposureProgram.label') },
  { key: 'exposureMode', label: t('admin.upload.fields.exposureMode.label') },
  { key: 'meteringMode', label: t('admin.upload.fields.meteringMode.label') },
  { key: 'whiteBalance', label: t('admin.upload.fields.whiteBalance.label') },
  { key: 'flash', label: t('admin.upload.fields.flash.label') },
  { key: 'colorSpace', label: t('admin.upload.fields.colorSpace.label') },
  { key: 'resolutionX', label: t('admin.upload.fields.resolutionX.label') },
  { key: 'resolutionY', label: t('admin.upload.fields.resolutionY.label') },
  { key: 'resolutionUnit', label: t('admin.upload.fields.resolutionUnit.label') },
  { key: 'software', label: t('admin.upload.fields.software.label') },
  { key: 'captureTime', label: t('admin.upload.fields.captureTime.label') },
  { key: 'notes', label: t('admin.upload.fields.notes.label') },
  { key: 'width', label: t('admin.files.form.width.label') },
  { key: 'height', label: t('admin.files.form.height.label') },
])

const seriesSelectItems = computed(() => {
  const rows = seriesOptionsData.value ?? []
  return rows
    .filter(row => !row.isVirtual)
    .map(row => ({
      label: row.title,
      value: row.id,
    }))
})

watch(
  files,
  (items) => {
    const available = new Set(items.map(item => item.id))
    selectedFileIds.value = selectedFileIds.value.filter(id => available.has(id))
  },
  { immediate: true },
)

watch(
  bulkMetadataCaptureTimeLocal,
  (value) => {
    bulkMetadataForm.captureTime = value ? toIsoWithOffset(value) : ''
  },
)

function hasDepthMap(file: FileResponse): boolean {
  const raw = file.metadata.depthMapUrl
  if (typeof raw === 'string') {
    return raw.trim().length > 0
  }
  return false
}

const missingDepthFiles = computed<FileResponse[]>(() => files.value.filter(file => !hasDepthMap(file)))
const missingDepthCount = computed(() => missingDepthFiles.value.length)
const depthBatchLabel = computed(() => t('admin.files.actions.depthBatch', {
  count: missingDepthCount.value,
  locale: locale.value,
}))

function resolvePreviewUrl(file: FileResponse): string {
  const primary = file.imageUrl.trim()
  if (primary) {
    return primary
  }
  return file.imageUrl
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
    return 'tabler:arrows-up-down'
  }
  return sortDirection.value === 'asc' ? 'tabler:arrow-up' : 'tabler:arrow-down'
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

function normalizeSelectedIds(ids: number[]): number[] {
  return [...new Set(ids.filter(id => Number.isInteger(id) && id > 0))]
}

function toggleSelectOnPage(checked: boolean): void {
  if (checked) {
    selectedFileIds.value = normalizeSelectedIds([...selectedFileIds.value, ...pageFileIds.value])
    return
  }
  const removeSet = new Set(pageFileIds.value)
  selectedFileIds.value = selectedFileIds.value.filter(id => !removeSet.has(id))
}

function toggleFileSelection(fileId: number, checked: boolean): void {
  if (checked) {
    selectedFileIds.value = normalizeSelectedIds([...selectedFileIds.value, fileId])
    return
  }
  selectedFileIds.value = selectedFileIds.value.filter(id => id !== fileId)
}

function clearSelection(): void {
  selectedFileIds.value = []
}

const editCaptureTimeLocal = ref<string>('')
const editingFile = ref<FileResponse | null>(null)
const editModalOpen = ref(false)
const updating = ref(false)
const replaceFile = ref<File | null>(null)
const editSeriesIds = ref<number[]>([])

async function generateDepthMap(file: FileResponse): Promise<void> {
  if (!import.meta.client || depthProcessing[file.id]) {
    return
  }

  depthProcessing[file.id] = true
  try {
    await uploadDepthMap({
      fileId: file.id,
      imageUrl: file.imageUrl ?? '',
      missingImageMessage: toastMessages.value.depthFailedFallback,
    })
    toast.add({ title: toastMessages.value.depthSuccess, description: toastMessages.value.depthSuccessDescription })
    await refresh()
    if (editingFile.value?.id === file.id) {
      const updated = filesData.value?.find(item => item.id === file.id)
      if (updated) {
        editingFile.value = updated
      }
    }
  }
  catch (error) {
    const message = error instanceof Error ? error.message : toastMessages.value.depthFailedFallback
    toast.add({ title: toastMessages.value.depthFailed, description: message, color: 'error' })
  }
  finally {
    depthProcessing[file.id] = false
  }
}

async function generateMissingDepthMaps(): Promise<void> {
  if (!import.meta.client || bulkDepthProcessing.value) {
    return
  }
  const targets = missingDepthFiles.value
  if (targets.length === 0) {
    return
  }

  bulkDepthProcessing.value = true
  batchProgress.total = targets.length
  batchProgress.processed = 0
  batchProgress.success = 0
  batchProgress.failed = 0
  batchProgress.skipped = 0
  try {
    for (const file of targets) {
      if (depthProcessing[file.id]) {
        batchProgress.skipped += 1
        batchProgress.processed += 1
        continue
      }
      depthProcessing[file.id] = true
      try {
        await uploadDepthMap({
          fileId: file.id,
          imageUrl: file.imageUrl ?? '',
          missingImageMessage: toastMessages.value.depthFailedFallback,
        })
        batchProgress.success += 1
      }
      catch {
        batchProgress.failed += 1
      }
      finally {
        depthProcessing[file.id] = false
        batchProgress.processed += 1
      }
    }

    await refresh()
    if (editingFile.value) {
      const updated = filesData.value?.find(item => item.id === editingFile.value?.id)
      if (updated) {
        editingFile.value = updated
      }
    }
    const summaryParams: Record<string, number> = {
      total: batchProgress.total,
      success: batchProgress.success,
      failed: batchProgress.failed,
      skipped: batchProgress.skipped,
    }
    const hasFailures = batchProgress.failed > 0
    toast.add({
      title: toastMessages.value.depthBatchTitle,
      description: t('admin.files.toast.depthBatchSummary', summaryParams),
      color: hasFailures ? 'warning' : 'primary',
    })
  }
  finally {
    bulkDepthProcessing.value = false
  }
}

async function handleGenerateDepthFromEdit(): Promise<void> {
  if (!editingFile.value) {
    return
  }
  await generateDepthMap(editingFile.value)
}

type EditableForm = MediaFormState

const editForm = reactive<EditableForm>(createEmptyMediaFormState())
const editFormModel = computed<EditableForm>({
  get: () => editForm,
  set: (value) => {
    Object.assign(editForm, value)
  },
})

function resetEditForm(): void {
  resetMediaFormState(editForm)
  editCaptureTimeLocal.value = ''
  replaceFile.value = null
}

function fillEditForm(file: FileResponse): void {
  const { captureTimeLocal, seriesIds } = fillMediaFormStateFromFile(editForm, file)
  editCaptureTimeLocal.value = captureTimeLocal
  editSeriesIds.value = seriesIds
}

function closeEdit(): void {
  editModalOpen.value = false
  editingFile.value = null
  editSeriesIds.value = []
  resetEditForm()
}

async function saveEdit(): Promise<void> {
  if (!editingFile.value) {
    return
  }
  updating.value = true
  try {
    const updated = await saveFileEdit({
      id: editingFile.value.id,
      form: editForm,
      replaceFile: replaceFile.value,
      fallbackWidth: editingFile.value.width,
      fallbackHeight: editingFile.value.height,
      seriesIds: editSeriesIds.value,
    })
    filesData.value = filesData.value?.map(file => (file.id === updated.id ? updated : file)) ?? []
    editingFile.value = updated
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

function resetBulkMetadataForm(): void {
  resetMediaFormState(bulkMetadataForm)
  bulkMetadataCaptureTimeLocal.value = ''
  selectedBatchFields.value = []
}

function openBulkMetadataModal(): void {
  if (selectedCount.value === 0) {
    toast.add({ title: toastMessages.value.bulkNoSelection, color: 'warning' })
    return
  }
  resetBulkMetadataForm()
  bulkMetadataModalOpen.value = true
}

function openBulkSeriesModal(): void {
  if (selectedCount.value === 0) {
    toast.add({ title: toastMessages.value.bulkNoSelection, color: 'warning' })
    return
  }
  selectedSeriesIdForBatch.value = null
  bulkSeriesModalOpen.value = true
  void refreshSeriesOptions()
}

function buildBatchMetadataChanges(): Record<string, unknown> {
  return {
    title: bulkMetadataForm.title,
    description: bulkMetadataForm.description,
    genre: bulkMetadataForm.genre,
    width: bulkMetadataForm.width,
    height: bulkMetadataForm.height,
    fanworkTitle: bulkMetadataForm.fanworkTitle,
    characters: bulkMetadataForm.characters,
    location: bulkMetadataForm.location,
    locationName: bulkMetadataForm.locationName,
    latitude: bulkMetadataForm.latitude,
    longitude: bulkMetadataForm.longitude,
    cameraModel: bulkMetadataForm.cameraModel,
    lensModel: bulkMetadataForm.lensModel,
    aperture: bulkMetadataForm.aperture,
    focalLength: bulkMetadataForm.focalLength,
    iso: bulkMetadataForm.iso,
    shutterSpeed: bulkMetadataForm.shutterSpeed,
    exposureBias: bulkMetadataForm.exposureBias,
    exposureProgram: bulkMetadataForm.exposureProgram,
    exposureMode: bulkMetadataForm.exposureMode,
    meteringMode: bulkMetadataForm.meteringMode,
    whiteBalance: bulkMetadataForm.whiteBalance,
    flash: bulkMetadataForm.flash,
    colorSpace: bulkMetadataForm.colorSpace,
    resolutionX: bulkMetadataForm.resolutionX,
    resolutionY: bulkMetadataForm.resolutionY,
    resolutionUnit: bulkMetadataForm.resolutionUnit,
    software: bulkMetadataForm.software,
    captureTime: bulkMetadataForm.captureTime,
    notes: bulkMetadataForm.notes,
  }
}

async function saveBulkMetadata(): Promise<void> {
  if (selectedCount.value === 0) {
    toast.add({ title: toastMessages.value.bulkNoSelection, color: 'warning' })
    return
  }
  if (selectedBatchFields.value.length === 0) {
    toast.add({ title: toastMessages.value.bulkNoFields, color: 'warning' })
    return
  }

  bulkMetadataSaving.value = true
  try {
    const result = await updateFilesBatchMetadata({
      fileIds: selectedFileIds.value,
      fieldMask: selectedBatchFields.value,
      changes: buildBatchMetadataChanges(),
    })
    await refresh()
    const hasFailures = result.failed > 0
    toast.add({
      title: hasFailures ? toastMessages.value.bulkMetadataFailed : toastMessages.value.bulkMetadataSuccess,
      description: `${result.success}/${result.total}`,
      color: hasFailures ? 'warning' : 'primary',
    })
    if (!hasFailures) {
      bulkMetadataModalOpen.value = false
    }
  }
  catch (error) {
    const message = error instanceof Error ? error.message : toastMessages.value.bulkFailedFallback
    toast.add({ title: toastMessages.value.bulkMetadataFailed, description: message, color: 'error' })
  }
  finally {
    bulkMetadataSaving.value = false
  }
}

async function saveBulkSeries(): Promise<void> {
  if (selectedCount.value === 0) {
    toast.add({ title: toastMessages.value.bulkNoSelection, color: 'warning' })
    return
  }
  if (!selectedSeriesIdForBatch.value) {
    toast.add({ title: t('admin.files.bulk.seriesRequired'), color: 'warning' })
    return
  }

  bulkSeriesSaving.value = true
  try {
    const result = await addFilesToSeriesBatch({
      fileIds: selectedFileIds.value,
      seriesId: selectedSeriesIdForBatch.value,
      action: 'add',
    })
    await refresh()
    const hasFailures = result.failed > 0
    toast.add({
      title: hasFailures ? toastMessages.value.bulkSeriesFailed : toastMessages.value.bulkSeriesSuccess,
      description: `${result.success}/${result.total}`,
      color: hasFailures ? 'warning' : 'primary',
    })
    if (!hasFailures) {
      bulkSeriesModalOpen.value = false
    }
  }
  catch (error) {
    const message = error instanceof Error ? error.message : toastMessages.value.bulkFailedFallback
    toast.add({ title: toastMessages.value.bulkSeriesFailed, description: message, color: 'error' })
  }
  finally {
    bulkSeriesSaving.value = false
  }
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
  clearSelection()
}

watch(fetchError, (value) => {
  if (value) {
    toast.add({ title: toastMessages.value.loadFailed, description: value.message, color: 'error' })
  }
})
</script>

<template>
  <div class="min-h-screen">
    <UContainer rails class="space-y-10 py-10">
      <AdminNav />

      <UPageHeader
        :eyebrow="t('admin.nav.label')"
        icon="tabler:shield-check"
        :title="t('admin.files.title')"
      >
        <template #actions>
          <UButton
            color="primary"
            variant="ghost"
            size="sm"
            :disabled="!hasFiles || reclassifying"
            :loading="reclassifying"
            icon="tabler:wand"
            @click="reclassifyMissing"
          >
            {{ t('admin.files.actions.reclassify') }}
          </UButton>
          <UButton
            color="primary"
            variant="ghost"
            size="sm"
            :disabled="missingDepthCount === 0 || bulkDepthProcessing"
            :loading="bulkDepthProcessing"
            icon="tabler:stack-2"
            @click="generateMissingDepthMaps"
          >
            {{ depthBatchLabel }}
          </UButton>
          <UButton
            color="primary"
            size="sm"
            :loading="isLoading"
            icon="tabler:refresh"
            @click="handleRefresh"
          >
            {{ t('admin.files.actions.refresh') }}
          </UButton>
        </template>
      </UPageHeader>

      <section
        v-if="showBatchProgress"
        class="space-y-2"
      >
        <div class="flex items-center justify-between gap-2 text-xs uppercase tracking-[0.12em] text-muted">
          <span class="flex items-center gap-1.5">
            <Icon name="tabler:stack-2" class="h-3.5 w-3.5" />
            <span>{{ t('admin.files.batch.title') }}</span>
          </span>
          <span>{{ batchProgressPercent.toFixed(1) }}%</span>
        </div>
        <div class="h-px w-full overflow-hidden bg-border-muted">
          <div
            class="h-full bg-primary transition-all"
            :style="{ width: `${batchProgressPercent}%` }"
          />
        </div>
        <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span>{{ batchProgressLabel }}</span>
          <span>{{ batchProgressSummary }}</span>
        </div>
      </section>

      <USection
        :label="t('admin.files.section.title')"
        icon="tabler:table"
      >
        <template #actions>
          <span class="text-xs text-muted">{{ recordCountText }}</span>
        </template>
        <div class="space-y-3">
          <div
            v-if="selectedCount > 0"
            class="flex flex-wrap items-center gap-2 border-l-2 border-primary bg-primary-soft/40 px-3 py-2"
          >
            <span class="text-sm font-medium text-highlighted">
              {{ t('admin.files.bulk.selected', { count: selectedCount }) }}
            </span>
            <UButton
              size="xs"
              color="primary"
              variant="soft"
              icon="tabler:edit"
              @click="openBulkMetadataModal"
            >
              {{ t('admin.files.bulk.editMetadata') }}
            </UButton>
            <UButton
              size="xs"
              color="primary"
              variant="soft"
              icon="tabler:photo-up"
              @click="openBulkSeriesModal"
            >
              {{ t('admin.files.bulk.addToSeries') }}
            </UButton>
            <UButton
              size="xs"
              color="neutral"
              variant="ghost"
              icon="tabler:x"
              @click="clearSelection"
            >
              {{ t('admin.files.bulk.clearSelection') }}
            </UButton>
          </div>
          <UTable
            :columns="tableColumns"
            :data="paginatedFiles"
            :loading="isLoading"
            :empty="tableEmptyText"
            :ui="tableUi"
          >
            <template #select-header>
              <div class="flex items-center">
                <input
                  type="checkbox"
                  :checked="allOnPageSelected"
                  :aria-label="t('admin.files.bulk.selectPage')"
                  class="h-4 w-4 cursor-pointer rounded border-default text-primary"
                  @change="toggleSelectOnPage(($event.target as HTMLInputElement).checked)"
                >
                <span v-if="someOnPageSelected" class="sr-only">{{ t('admin.files.bulk.partialSelected') }}</span>
              </div>
            </template>
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
            <template #select-cell="{ row }">
              <div class="flex items-center">
                <input
                  type="checkbox"
                  :checked="selectedFileIdSet.has(row.original.id)"
                  :aria-label="t('admin.files.bulk.selectOne', { id: row.original.id })"
                  class="h-4 w-4 cursor-pointer rounded border-default text-primary"
                  @change="toggleFileSelection(row.original.id, ($event.target as HTMLInputElement).checked)"
                >
              </div>
            </template>
            <template #preview-cell="{ row }">
              <div class="h-14 w-24 overflow-hidden rounded-none bg-black/5">
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
                <UButton
                  size="xs"
                  variant="soft"
                  color="primary"
                  icon="tabler:pencil"
                  @click="openEdit(row.original)"
                >
                  {{ t('common.actions.edit') }}
                </UButton>
                <UButton
                  size="xs"
                  variant="soft"
                  color="error"
                  :loading="deletingId === row.original.id"
                  icon="tabler:trash"
                  @click="openDelete(row.original)"
                >
                  {{ t('common.actions.delete') }}
                </UButton>
              </div>
            </template>
          </UTable>
          <div class="flex flex-col gap-3 border-t border-border-muted pt-3 sm:flex-row sm:items-center sm:justify-between">
            <div class="text-sm text-muted">
              {{ paginationText }}
            </div>
            <UPagination v-model:page="page" :items-per-page="pageSize" :total="totalFiles" />
          </div>
        </div>
      </USection>
    </UContainer>

    <AdminEditModal
      v-model:open="editModalOpen"
      v-model:form="editFormModel"
      v-model:series-ids="editSeriesIds"
      v-model:capture-time-local="editCaptureTimeLocal"
      v-model:replace-file="replaceFile"
      :file="editingFile"
      :loading="updating"
      :enable-depth-action="true"
      :depth-processing="editingFile ? depthProcessing[editingFile.id] : false"
      :classify-source="{ imageUrl: editingFile?.imageUrl || '' }"
      @submit="saveEdit"
      @close="closeEdit"
      @generate-depth="handleGenerateDepthFromEdit"
    />
    <UModal
      v-model:open="deleteModalOpen"
      size="sm"
      :title="t('admin.files.delete.heading')"
      :description="t('admin.files.delete.description')"
    >
      <div class="space-y-4">
        <dl class="space-y-1.5 text-sm">
          <div class="flex gap-2">
            <dt class="w-24 shrink-0 text-muted">
              {{ t('admin.files.delete.titleLabel') }}
            </dt>
            <dd class="font-medium">
              {{ deleteTarget?.title || untitledLabel }}
            </dd>
          </div>
          <div class="flex gap-2">
            <dt class="w-24 shrink-0 text-muted">
              {{ t('admin.files.delete.createdAtLabel') }}
            </dt>
            <dd class="text-toned">
              {{ deleteTarget ? formatDateTime(deleteTarget.createdAt) : '' }}
            </dd>
          </div>
        </dl>
        <div class="flex justify-end gap-2 border-t border-border-muted pt-3">
          <UButton variant="ghost" color="neutral" @click="deleteModalOpen = false">
            {{ t('common.actions.cancel') }}
          </UButton>
          <UButton
            color="error"
            :loading="deletingId !== null"
            icon="tabler:trash"
            @click="confirmDelete"
          >
            {{ t('admin.files.delete.confirm') }}
          </UButton>
        </div>
      </div>
    </UModal>

    <UModal
      v-model:open="bulkMetadataModalOpen"
      size="xl"
      scrollable
      :title="t('admin.files.bulk.editMetadata')"
      :description="t('admin.files.bulk.selected', { count: selectedCount })"
    >
      <UForm :state="bulkMetadataForm" class="space-y-6" @submit.prevent="saveBulkMetadata">
        <div class="space-y-3">
          <p class="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            {{ t('admin.files.bulk.fields') }}
          </p>
          <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <label
              v-for="field in batchEditableFields"
              :key="field.key"
              class="flex items-center gap-2 border-l border-border-muted pl-2 text-sm transition-colors hover:border-primary"
            >
              <input
                type="checkbox"
                class="h-4 w-4 cursor-pointer accent-primary"
                :checked="selectedBatchFields.includes(field.key)"
                @change="(event) => {
                  const checked = (event.target as HTMLInputElement).checked
                  if (checked) {
                    selectedBatchFields = [...new Set([...selectedBatchFields, field.key])]
                  }
                  else {
                    selectedBatchFields = selectedBatchFields.filter(item => item !== field.key)
                  }
                }"
              >
              <span>{{ field.label }}</span>
            </label>
          </div>
        </div>

        <AdminMetadataForm
          :form="bulkMetadataForm"
          v-model:capture-time-local="bulkMetadataCaptureTimeLocal"
          :classify-source="{ imageUrl: '' }"
        />
        <div class="flex justify-end gap-2 border-t border-border-muted pt-3">
          <UButton variant="ghost" color="neutral" @click="bulkMetadataModalOpen = false">
            {{ t('common.actions.cancel') }}
          </UButton>
          <UButton
            color="primary"
            type="submit"
            icon="tabler:device-floppy"
            :loading="bulkMetadataSaving"
          >
            {{ t('common.actions.save') }}
          </UButton>
        </div>
      </UForm>
    </UModal>

    <UModal
      v-model:open="bulkSeriesModalOpen"
      size="md"
      :title="t('admin.files.bulk.addToSeries')"
      :description="t('admin.files.bulk.selected', { count: selectedCount })"
    >
      <div class="space-y-4">
        <UFormField :label="t('admin.files.bulk.seriesTarget')">
          <USelect
            v-model="selectedSeriesIdForBatchModel"
            class="w-full"
            :items="seriesSelectItems"
            value-attribute="value"
            option-attribute="label"
            :placeholder="t('admin.files.bulk.seriesPlaceholder')"
          />
        </UFormField>
        <div class="flex justify-end gap-2 border-t border-border-muted pt-3">
          <UButton variant="ghost" color="neutral" @click="bulkSeriesModalOpen = false">
            {{ t('common.actions.cancel') }}
          </UButton>
          <UButton
            color="primary"
            icon="tabler:photo-up"
            :loading="bulkSeriesSaving"
            @click="saveBulkSeries"
          >
            {{ t('admin.files.bulk.confirmAddSeries') }}
          </UButton>
        </div>
      </div>
    </UModal>
  </div>
</template>
