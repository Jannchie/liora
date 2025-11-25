<script setup lang="ts">
import type { ImageSizes } from '@nuxt/image'
import type { FileResponse } from '~/types/file'
import { computed, reactive, ref, watch } from 'vue'

const { t } = useI18n()
definePageMeta({
  middleware: 'admin-auth',
})

const toast = useToast()
const image = useImage()

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

const totalFiles = computed(() => files.value.length)
const pageCount = computed(() => Math.max(1, Math.ceil(totalFiles.value / pageSize.value)))
const paginatedFiles = computed<FileResponse[]>(() => {
  const start = (page.value - 1) * pageSize.value
  return files.value.slice(start, start + pageSize.value)
})
const recordCountText = computed(() => t('common.labels.recordCount', { count: totalFiles.value }))
const paginationText = computed(() => t('common.labels.pageIndicator', { page: page.value, pageCount: pageCount.value }))
const tableEmptyText = computed(() => t('admin.files.table.empty'))
const untitledLabel = computed(() => t('common.labels.untitled'))
const unknownLabel = computed(() => t('common.labels.unknown'))

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
  { id: 'size', header: t('admin.files.table.headers.size'), accessorFn: (row: FileResponse) => `${row.width}×${row.height}` },
  { id: 'location', header: t('admin.files.table.headers.location'), accessorFn: (row: FileResponse) => row.location },
  { id: 'captureTime', header: t('admin.files.table.headers.captureTime'), accessorFn: (row: FileResponse) => row.metadata.captureTime || row.createdAt },
  { accessorKey: 'createdAt', id: 'createdAt', header: t('admin.files.table.headers.createdAt') },
  { id: 'actions', header: t('admin.files.table.headers.actions'), accessorFn: (row: FileResponse) => row.id },
])

function resolvePreviewUrl(file: FileResponse): string {
  return file.imageUrl.trim()
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

function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return date.toLocaleString()
}

const pad = (value: number): string => value.toString().padStart(2, '0')

function toLocalInputString(isoString: string): string {
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  const hours = pad(date.getHours())
  const minutes = pad(date.getMinutes())
  const seconds = pad(date.getSeconds())
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`
}

interface EditableForm {
  title: string
  description: string
  width: number
  height: number
  fanworkTitle: string
  characters: string[]
  location: string
  locationName: string
  latitude: number | null
  longitude: number | null
  cameraModel: string
  aperture: string
  focalLength: string
  iso: string
  shutterSpeed: string
  captureTime: string
  notes: string
}

const editForm = reactive<EditableForm>({
  title: '',
  description: '',
  width: 0,
  height: 0,
  fanworkTitle: '',
  characters: [],
  location: '',
  locationName: '',
  latitude: null,
  longitude: null,
  cameraModel: '',
  aperture: '',
  focalLength: '',
  iso: '',
  shutterSpeed: '',
  captureTime: '',
  notes: '',
})

const editCaptureTimeLocal = ref<string>('')
const editCharactersText = ref<string>('')
const editingFile = ref<FileResponse | null>(null)
const editModalOpen = ref(false)
const updating = ref(false)

function resetEditForm(): void {
  editForm.title = ''
  editForm.description = ''
  editForm.width = 0
  editForm.height = 0
  editForm.fanworkTitle = ''
  editForm.characters = []
  editForm.location = ''
  editForm.locationName = ''
  editForm.latitude = null
  editForm.longitude = null
  editForm.cameraModel = ''
  editForm.aperture = ''
  editForm.focalLength = ''
  editForm.iso = ''
  editForm.shutterSpeed = ''
  editForm.captureTime = ''
  editCaptureTimeLocal.value = ''
  editForm.notes = ''
  editCharactersText.value = ''
}

function fillEditForm(file: FileResponse): void {
  const metadata = file.metadata
  editForm.title = file.title ?? ''
  editForm.description = file.description ?? ''
  editForm.width = file.width
  editForm.height = file.height
  editForm.fanworkTitle = metadata.fanworkTitle || file.fanworkTitle || ''
  editForm.characters = metadata.characters ?? file.characters ?? []
  editForm.location = metadata.location || file.location || ''
  editForm.locationName = metadata.locationName
  editForm.latitude = metadata.latitude
  editForm.longitude = metadata.longitude
  editForm.cameraModel = metadata.cameraModel || file.cameraModel || ''
  editForm.aperture = metadata.aperture || ''
  editForm.focalLength = metadata.focalLength || ''
  editForm.iso = metadata.iso || ''
  editForm.shutterSpeed = metadata.shutterSpeed || ''
  editForm.captureTime = metadata.captureTime || ''
  editCaptureTimeLocal.value = editForm.captureTime ? toLocalInputString(editForm.captureTime) : ''
  editForm.notes = metadata.notes || ''
  editCharactersText.value = editForm.characters.join(', ')
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
    const characters = editCharactersText.value.length > 0
      ? editCharactersText.value.split(/[,，\n]/).map(value => value.trim()).filter(value => value.length > 0)
      : editForm.characters
    const updated = await $fetch<FileResponse>(`/api/files/${editingFile.value.id}`, {
      method: 'PUT',
      body: {
        ...editForm,
        characters,
        captureTime: editForm.captureTime || undefined,
      },
    })
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
    toast.add({ title: toastMessages.value.deleteSuccess, description: toastMessages.value.deleteSuccessDescription, color: 'primary' })
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
          <p class="flex items-center gap-2 text-sm">
            <Icon name="mdi:eye-outline" class="h-4 w-4 text-primary" />
            <span>{{ t('admin.nav.label') }}</span>
          </p>
          <h1 class="flex items-center gap-2 text-3xl font-semibold">
            <Icon name="mdi:view-list-outline" class="h-6 w-6 text-primary" />
            <span>{{ t('admin.files.title') }}</span>
          </h1>
          <p class="text-sm">
            {{ t('admin.files.subtitle') }}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <UButton to="/admin/upload" variant="ghost" color="primary">
            <span class="flex items-center gap-2">
              <Icon name="mdi:upload-outline" class="h-4 w-4" />
              <span>{{ t('admin.files.actions.toUpload') }}</span>
            </span>
          </UButton>
          <UButton color="primary" variant="solid" :loading="isLoading" @click="handleRefresh">
            <span class="flex items-center gap-2">
              <Icon name="mdi:refresh" class="h-4 w-4" />
              <span>{{ t('admin.files.actions.refresh') }}</span>
            </span>
          </UButton>
        </div>
      </header>

      <section class="space-y-3">
        <div class="flex items-center justify-between">
          <div>
            <p class="flex items-center gap-2 text-sm">
              <Icon name="mdi:database-outline" class="h-4 w-4 text-primary" />
              <span>{{ t('admin.files.section.label') }}</span>
            </p>
            <h2 class="flex items-center gap-2 text-xl font-semibold">
              <Icon name="mdi:table" class="h-5 w-5 text-primary" />
              <span>{{ t('admin.files.section.title') }}</span>
            </h2>
          </div>
          <div class="flex items-center gap-2 text-sm text-neutral-500">
            <Icon name="mdi:counter" class="h-4 w-4" />
            <span>{{ recordCountText }}</span>
          </div>
        </div>
        <UCard>
          <UTable
            :columns="tableColumns"
            :data="paginatedFiles"
            :loading="isLoading"
            :empty="tableEmptyText"
          >
            <template #preview-cell="{ row }">
              <div class="h-14 w-24 overflow-hidden rounded-md bg-black/5">
                <img
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
                <p v-if="row.original.description" class="text-xs text-neutral-500 line-clamp-2">
                  {{ row.original.description }}
                </p>
              </div>
            </template>
            <template #size-cell="{ row }">
              <span class="text-sm text-neutral-600">{{ row.original.width }} × {{ row.original.height }}</span>
            </template>
            <template #location-cell="{ row }">
              <span class="text-sm text-neutral-600">
                {{ row.original.metadata.locationName || row.original.location || unknownLabel }}
              </span>
            </template>
            <template #captureTime-cell="{ row }">
              <span class="text-sm text-neutral-600">
                {{ formatDateTime(row.original.metadata.captureTime || row.original.createdAt) || unknownLabel }}
              </span>
            </template>
            <template #createdAt-cell="{ row }">
              <span class="text-sm text-neutral-600">
                {{ formatDateTime(row.original.createdAt) }}
              </span>
            </template>
            <template #actions-cell="{ row }">
              <div class="flex items-center gap-2">
                <UButton size="xs" variant="ghost" color="primary" @click="openEdit(row.original)">
                  <span class="flex items-center gap-1.5">
                    <Icon name="mdi:pencil-outline" class="h-4 w-4" />
                    <span>{{ t('common.actions.edit') }}</span>
                  </span>
                </UButton>
                <UButton
                  size="xs"
                  variant="ghost"
                  color="error"
                  :loading="deletingId === row.original.id"
                  @click="openDelete(row.original)"
                >
                  <span class="flex items-center gap-1.5">
                    <Icon name="mdi:trash-can-outline" class="h-4 w-4" />
                    <span>{{ t('common.actions.delete') }}</span>
                  </span>
                </UButton>
              </div>
            </template>
          </UTable>
          <div class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div class="text-sm text-neutral-500">
              {{ paginationText }}
            </div>
            <UPagination v-model:page="page" :items-per-page="pageSize" :total="totalFiles" />
          </div>
        </UCard>
      </section>
    </UContainer>

    <UModal
      v-model:open="editModalOpen"
      fullscreen
      scrollable
      :ui="{ content: 'fixed inset-0 w-screen h-screen max-w-none max-h-none rounded-none p-0 sm:p-0 !top-0 !left-0 !translate-x-0 !translate-y-0 !m-0' }"
    >
      <template #content>
        <div class="flex h-full flex-col bg-default/85 backdrop-blur">
          <div class="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-default/40 bg-default/90 px-5 py-4 backdrop-blur">
            <div>
              <p class="text-sm">
                {{ t('admin.files.editModal.lead') }}
              </p>
              <h3 class="text-lg font-semibold">
                {{ editingFile?.title || t('admin.files.editModal.fallbackTitle') }}
              </h3>
              <p class="text-xs text-neutral-500">
                {{ t('admin.files.editModal.subtitle') }}
              </p>
            </div>
            <UButton variant="ghost" color="neutral" @click="closeEdit">
              <span class="flex items-center gap-1.5">
                <Icon name="mdi:close" class="h-4 w-4" />
                <span>{{ t('common.actions.close') }}</span>
              </span>
            </UButton>
          </div>
          <div class="relative flex-1 overflow-y-auto px-5 py-4">
            <UForm :state="editForm" class="space-y-5 pb-16" @submit.prevent="saveEdit">
              <section class="space-y-3 rounded-xl bg-default/70 p-4 shadow-sm backdrop-blur">
                <div class="flex items-center gap-2">
                  <Icon name="mdi:calendar-clock-outline" class="h-4 w-4 text-primary" />
                  <div>
                    <p class="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      时间与标题
                    </p>
                    <p class="text-sm text-neutral-600">
                      拍摄时间与摘要信息
                    </p>
                  </div>
                </div>
                <div class="grid gap-3 sm:grid-cols-2">
                  <UFormField class="sm:col-span-2" :label="t('admin.files.form.captureTime.label')" name="captureTime">
                    <UInput v-model="editCaptureTimeLocal" type="datetime-local" step="1" :placeholder="t('admin.files.form.captureTime.placeholder')" />
                  </UFormField>
                  <UFormField :label="t('admin.files.form.title.label')" name="title">
                    <UInput v-model="editForm.title" :placeholder="t('admin.files.form.title.placeholder')" />
                  </UFormField>
                  <UFormField :label="t('admin.files.form.description.label')" name="description">
                    <UTextarea v-model="editForm.description" :rows="2" :placeholder="t('admin.files.form.description.placeholder')" />
                  </UFormField>
                </div>
              </section>

              <section class="space-y-3 rounded-xl bg-default/70 p-4 shadow-sm backdrop-blur">
                <div class="flex items-center gap-2">
                  <Icon name="mdi:account-music-outline" class="h-4 w-4 text-primary" />
                  <div>
                    <p class="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      作品归属
                    </p>
                    <p class="text-sm text-neutral-600">
                      同人、角色与说明
                    </p>
                  </div>
                </div>
                <div class="grid gap-3 sm:grid-cols-2">
                  <UFormField :label="t('admin.files.form.fanworkTitle.label')" name="fanworkTitle">
                    <UInput v-model="editForm.fanworkTitle" :placeholder="t('admin.files.form.fanworkTitle.placeholder')" />
                  </UFormField>
                  <UFormField :label="t('admin.files.form.characters.label')" name="characters">
                    <UTextarea v-model="editCharactersText" :rows="2" :placeholder="t('admin.files.form.characters.placeholder')" />
                  </UFormField>
                </div>
              </section>

              <section class="space-y-3 rounded-xl bg-default/70 p-4 shadow-sm backdrop-blur">
                <div class="flex items-center gap-2">
                  <Icon name="mdi:image-size-select-large" class="h-4 w-4 text-primary" />
                  <div>
                    <p class="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      尺寸与地点
                    </p>
                    <p class="text-sm text-neutral-600">
                      画幅与地理信息
                    </p>
                  </div>
                </div>
                <div class="grid gap-3 sm:grid-cols-2">
                  <UFormField :label="t('admin.files.form.width.label')" name="width">
                    <UInput v-model.number="editForm.width" type="number" min="1" :placeholder="t('admin.files.form.width.placeholder')" />
                  </UFormField>
                  <UFormField :label="t('admin.files.form.height.label')" name="height">
                    <UInput v-model.number="editForm.height" type="number" min="1" :placeholder="t('admin.files.form.height.placeholder')" />
                  </UFormField>
                  <UFormField :label="t('admin.files.form.locationName.label')" name="locationName">
                    <UInput v-model="editForm.locationName" :placeholder="t('admin.files.form.locationName.placeholder')" />
                  </UFormField>
                  <UFormField :label="t('admin.files.form.location.label')" name="location">
                    <UInput v-model="editForm.location" :placeholder="t('admin.files.form.location.placeholder')" />
                  </UFormField>
                  <UFormField :label="t('admin.files.form.latitude.label')" name="latitude">
                    <UInput v-model.number="editForm.latitude" type="number" step="0.000001" placeholder="39.9087" />
                  </UFormField>
                  <UFormField :label="t('admin.files.form.longitude.label')" name="longitude">
                    <UInput v-model.number="editForm.longitude" type="number" step="0.000001" placeholder="116.3975" />
                  </UFormField>
                </div>
              </section>

              <section class="space-y-3 rounded-xl bg-default/70 p-4 shadow-sm backdrop-blur">
                <div class="flex items-center gap-2">
                  <Icon name="mdi:camera-wireless-outline" class="h-4 w-4 text-primary" />
                  <div>
                    <p class="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      器材与曝光
                    </p>
                    <p class="text-sm text-neutral-600">
                      相机、镜头与曝光数据
                    </p>
                  </div>
                </div>
                <UFormField :label="t('admin.files.form.cameraModel.label')" name="cameraModel">
                  <UInput v-model="editForm.cameraModel" :placeholder="t('admin.files.form.cameraModel.placeholder')" />
                </UFormField>
                <div class="grid gap-3 sm:grid-cols-2">
                  <UFormField :label="t('admin.files.form.aperture.label')" name="aperture">
                    <UInput v-model="editForm.aperture" :placeholder="t('admin.files.form.aperture.placeholder')" />
                  </UFormField>
                  <UFormField :label="t('admin.files.form.focalLength.label')" name="focalLength">
                    <UInput v-model="editForm.focalLength" :placeholder="t('admin.files.form.focalLength.placeholder')" />
                  </UFormField>
                  <UFormField :label="t('admin.files.form.shutterSpeed.label')" name="shutterSpeed">
                    <UInput v-model="editForm.shutterSpeed" :placeholder="t('admin.files.form.shutterSpeed.placeholder')" />
                  </UFormField>
                  <UFormField name="iso" label="ISO">
                    <UInput v-model="editForm.iso" placeholder="800" />
                  </UFormField>
                </div>
              </section>

              <section class="space-y-3 rounded-xl bg-default/70 p-4 shadow-sm backdrop-blur">
                <div class="flex items-center gap-2">
                  <Icon name="mdi:note-text-outline" class="h-4 w-4 text-primary" />
                  <div>
                    <p class="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      备注
                    </p>
                    <p class="text-sm text-neutral-600">
                      补充记录与检索标签
                    </p>
                  </div>
                </div>
                <UFormField :label="t('admin.files.form.notes.label')" name="notes">
                  <UTextarea v-model="editForm.notes" :rows="2" :placeholder="t('admin.files.form.notes.placeholder')" />
                </UFormField>
              </section>

              <div class="sticky bottom-0 flex justify-end gap-2 border-t border-default/30 bg-default/90 px-1 py-3 backdrop-blur">
                <UButton variant="ghost" color="neutral" @click="closeEdit">
                  <span class="flex items-center gap-1.5">
                    <Icon name="mdi:arrow-left" class="h-4 w-4" />
                    <span>{{ t('common.actions.cancel') }}</span>
                  </span>
                </UButton>
                <UButton color="primary" type="submit" :loading="updating">
                  <span class="flex items-center gap-1.5">
                    <Icon name="mdi:content-save-outline" class="h-4 w-4" />
                    <span>{{ t('common.actions.save') }}</span>
                  </span>
                </UButton>
              </div>
            </UForm>
          </div>
        </div>
      </template>
    </UModal>
    <UModal v-model:open="deleteModalOpen">
      <template #content>
        <UCard class="w-full max-w-xl">
          <template #header>
            <div class="flex items-start justify-between">
              <div>
                <p class="text-sm text-error-500">
                  {{ t('admin.files.delete.title') }}
                </p>
                <h3 class="text-lg font-semibold">
                  {{ t('admin.files.delete.heading') }}
                </h3>
                <p class="text-xs text-neutral-500">
                  {{ t('admin.files.delete.description') }}
                </p>
              </div>
              <UButton variant="ghost" color="neutral" @click="deleteModalOpen = false">
                <span class="flex items-center gap-1.5">
                  <Icon name="mdi:close" class="h-4 w-4" />
                  <span>{{ t('common.actions.close') }}</span>
                </span>
              </UButton>
            </div>
          </template>
          <div class="space-y-3">
            <p class="text-sm">
              {{ t('admin.files.delete.titleLabel') }}<span class="font-medium">{{ deleteTarget?.title || untitledLabel }}</span>
            </p>
            <p class="text-sm text-neutral-600">
              {{ t('admin.files.delete.createdAtLabel') }}{{ deleteTarget ? formatDateTime(deleteTarget.createdAt) : '' }}
            </p>
          </div>
          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton variant="ghost" color="neutral" @click="deleteModalOpen = false">
                <span class="flex items-center gap-1.5">
                  <Icon name="mdi:arrow-left" class="h-4 w-4" />
                  <span>{{ t('common.actions.cancel') }}</span>
                </span>
              </UButton>
              <UButton color="error" :loading="deletingId !== null" @click="confirmDelete">
                <span class="flex items-center gap-1.5">
                  <Icon name="mdi:trash-can-outline" class="h-4 w-4" />
                  <span>{{ t('admin.files.delete.confirm') }}</span>
                </span>
              </UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </div>
</template>
