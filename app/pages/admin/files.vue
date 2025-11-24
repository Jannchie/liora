<script setup lang="ts">
import type { ImageSizes } from '@nuxt/image'
import type { FileKind, FileResponse } from '~/types/file'
import { computed, reactive, ref, watch } from 'vue'

definePageMeta({
  middleware: 'admin-auth',
})

const toast = useToast()
const image = useImage()

const pageTitle = '作品列表 | Liora'
const pageDescription = '查看与维护已上传的作品记录。'

useSeoMeta({
  title: pageTitle,
  ogTitle: pageTitle,
  description: pageDescription,
  ogDescription: pageDescription,
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

const tableColumns = [
  { id: 'preview', header: '预览', accessorFn: (row: FileResponse) => row.imageUrl },
  { accessorKey: 'title', id: 'title', header: '标题' },
  { accessorKey: 'kind', id: 'kind', header: '类型' },
  { id: 'size', header: '尺寸', accessorFn: (row: FileResponse) => `${row.width}×${row.height}` },
  { id: 'location', header: '地点', accessorFn: (row: FileResponse) => row.location },
  { id: 'captureTime', header: '拍摄时间', accessorFn: (row: FileResponse) => row.metadata.captureTime || row.createdAt },
  { accessorKey: 'createdAt', id: 'createdAt', header: '创建时间' },
  { id: 'actions', header: '操作', accessorFn: (row: FileResponse) => row.id },
]

const kindOptions = [
  { label: '摄影', value: 'PHOTOGRAPHY' },
  { label: '插画', value: 'PAINTING' },
]

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
  kind: FileKind
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
  kind: 'PHOTOGRAPHY',
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
  editForm.kind = 'PHOTOGRAPHY'
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
  editForm.kind = file.kind
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
    toast.add({ title: '已更新', description: '记录已保存。', color: 'primary' })
    closeEdit()
  }
  catch (error) {
    const message = error instanceof Error ? error.message : '更新失败'
    toast.add({ title: '更新失败', description: message, color: 'error' })
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
    toast.add({ title: '已删除', description: '记录已移除。', color: 'primary' })
    deleteModalOpen.value = false
  }
  catch (error) {
    const message = error instanceof Error ? error.message : '删除失败'
    toast.add({ title: '删除失败', description: message, color: 'error' })
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
    toast.add({ title: '加载失败', description: value.message, color: 'error' })
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
            <span>后台</span>
          </p>
          <h1 class="flex items-center gap-2 text-3xl font-semibold">
            <Icon name="mdi:view-list-outline" class="h-6 w-6 text-primary" />
            <span>数据列表</span>
          </h1>
          <p class="text-sm">
            查看已有作品记录，支持编辑和删除。
          </p>
        </div>
        <div class="flex items-center gap-2">
          <UButton to="/admin/upload" variant="ghost" color="primary">
            <span class="flex items-center gap-2">
              <Icon name="mdi:upload-outline" class="h-4 w-4" />
              <span>去上传</span>
            </span>
          </UButton>
          <UButton color="primary" variant="solid" :loading="isLoading" @click="handleRefresh">
            <span class="flex items-center gap-2">
              <Icon name="mdi:refresh" class="h-4 w-4" />
              <span>刷新数据</span>
            </span>
          </UButton>
        </div>
      </header>

      <section class="space-y-3">
        <div class="flex items-center justify-between">
          <div>
            <p class="flex items-center gap-2 text-sm">
              <Icon name="mdi:database-outline" class="h-4 w-4 text-primary" />
              <span>作品列表</span>
            </p>
            <h2 class="flex items-center gap-2 text-xl font-semibold">
              <Icon name="mdi:table" class="h-5 w-5 text-primary" />
              <span>数据总览</span>
            </h2>
          </div>
          <div class="flex items-center gap-2 text-sm text-neutral-500">
            <Icon name="mdi:counter" class="h-4 w-4" />
            <span>共 {{ totalFiles }} 条记录</span>
          </div>
        </div>
        <UCard>
          <UTable
            :columns="tableColumns"
            :data="paginatedFiles"
            :loading="isLoading"
            empty="暂无数据，先录入一条。"
          >
            <template #preview-cell="{ row }">
              <div class="h-14 w-24 overflow-hidden rounded-md bg-black/5">
                <img
                  :alt="row.original.title || '预览'"
                  loading="lazy"
                  class="h-full w-full object-cover"
                  v-bind="resolvePreviewImage(row.original)"
                >
              </div>
            </template>
            <template #title-cell="{ row }">
              <div class="space-y-1">
                <p class="font-medium leading-tight">
                  {{ row.original.title || '未命名' }}
                </p>
                <p v-if="row.original.description" class="text-xs text-neutral-500 line-clamp-2">
                  {{ row.original.description }}
                </p>
              </div>
            </template>
            <template #kind-cell="{ row }">
              <UBadge color="primary" variant="soft">
                {{ row.original.kind === 'PHOTOGRAPHY' ? '摄影' : '插画' }}
              </UBadge>
            </template>
            <template #size-cell="{ row }">
              <span class="text-sm text-neutral-600">{{ row.original.width }} × {{ row.original.height }}</span>
            </template>
            <template #location-cell="{ row }">
              <span class="text-sm text-neutral-600">
                {{ row.original.metadata.locationName || row.original.location || '—' }}
              </span>
            </template>
            <template #captureTime-cell="{ row }">
              <span class="text-sm text-neutral-600">
                {{ formatDateTime(row.original.metadata.captureTime || row.original.createdAt) || '—' }}
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
                    <span>编辑</span>
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
                    <span>删除</span>
                  </span>
                </UButton>
              </div>
            </template>
          </UTable>
          <div class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div class="text-sm text-neutral-500">
              第 {{ page }} / {{ pageCount }} 页
            </div>
            <UPagination v-model:page="page" :items-per-page="pageSize" :total="totalFiles" />
          </div>
        </UCard>
      </section>
    </UContainer>

    <UModal v-model:open="editModalOpen">
      <template #content>
        <UCard class="w-full max-w-4xl">
          <template #header>
            <div class="flex items-start justify-between">
              <div>
                <p class="text-sm">
                  编辑
                </p>
                <h3 class="text-lg font-semibold">
                  {{ editingFile?.title || '调整元数据' }}
                </h3>
                <p class="text-xs text-neutral-500">
                  更新尺寸、拍摄信息或备注。
                </p>
              </div>
              <UButton variant="ghost" color="neutral" @click="closeEdit">
                <span class="flex items-center gap-1.5">
                  <Icon name="mdi:close" class="h-4 w-4" />
                  <span>关闭</span>
                </span>
              </UButton>
            </div>
          </template>
          <UForm :state="editForm" class="space-y-4" @submit.prevent="saveEdit">
            <div class="grid gap-3 sm:grid-cols-2">
              <UFormField name="kind" label="类型">
                <USelect v-model="editForm.kind" :options="kindOptions" />
              </UFormField>
              <UFormField name="captureTime" label="拍摄时间">
                <UInput v-model="editCaptureTimeLocal" type="datetime-local" step="1" placeholder="选择拍摄时间" />
              </UFormField>
            </div>

            <div class="grid gap-3 sm:grid-cols-2">
              <UFormField name="title" label="标题">
                <UInput v-model="editForm.title" placeholder="未命名作品" />
              </UFormField>
              <UFormField name="description" label="介绍">
                <UTextarea v-model="editForm.description" :rows="2" placeholder="一句话介绍" />
              </UFormField>
            </div>

            <div class="grid gap-3 sm:grid-cols-2">
              <UFormField name="fanworkTitle" label="作品名（同人/系列）">
                <UInput v-model="editForm.fanworkTitle" placeholder="系列或关联作品名称" />
              </UFormField>
              <UFormField name="characters" label="角色/标签">
                <UTextarea v-model="editCharactersText" :rows="2" placeholder="用逗号或换行分隔多个角色" />
              </UFormField>
            </div>

            <div class="grid gap-3 sm:grid-cols-2">
              <UFormField name="width" label="宽度">
                <UInput v-model.number="editForm.width" type="number" min="1" placeholder="800" />
              </UFormField>
              <UFormField name="height" label="高度">
                <UInput v-model.number="editForm.height" type="number" min="1" placeholder="1200" />
              </UFormField>
            </div>

            <div class="grid gap-3 sm:grid-cols-2">
              <UFormField name="locationName" label="标准地名">
                <UInput v-model="editForm.locationName" placeholder="如：北京市东城区故宫博物院" />
              </UFormField>
              <UFormField name="location" label="自定义地名">
                <UInput v-model="editForm.location" placeholder="可写简称或自定义" />
              </UFormField>
            </div>

            <div class="grid gap-3 sm:grid-cols-2">
              <UFormField name="latitude" label="纬度">
                <UInput v-model.number="editForm.latitude" type="number" step="0.000001" placeholder="39.9087" />
              </UFormField>
              <UFormField name="longitude" label="经度">
                <UInput v-model.number="editForm.longitude" type="number" step="0.000001" placeholder="116.3975" />
              </UFormField>
            </div>

            <UFormField name="cameraModel" label="器材型号">
              <UInput v-model="editForm.cameraModel" placeholder="Fujifilm X100VI" />
            </UFormField>

            <div class="grid gap-3 sm:grid-cols-2">
              <UFormField name="aperture" label="光圈">
                <UInput v-model="editForm.aperture" placeholder="f/1.8" />
              </UFormField>
              <UFormField name="focalLength" label="焦距">
                <UInput v-model="editForm.focalLength" placeholder="35mm" />
              </UFormField>
            </div>

            <div class="grid gap-3 sm:grid-cols-2">
              <UFormField name="shutterSpeed" label="快门">
                <UInput v-model="editForm.shutterSpeed" placeholder="1/125s" />
              </UFormField>
              <UFormField name="iso" label="ISO">
                <UInput v-model="editForm.iso" placeholder="800" />
              </UFormField>
            </div>

            <UFormField name="notes" label="备注">
              <UTextarea v-model="editForm.notes" :rows="2" placeholder="补充故事或说明" />
            </UFormField>

            <div class="flex justify-end gap-2">
              <UButton variant="ghost" color="neutral" @click="closeEdit">
                <span class="flex items-center gap-1.5">
                  <Icon name="mdi:arrow-left" class="h-4 w-4" />
                  <span>取消</span>
                </span>
              </UButton>
              <UButton color="primary" type="submit" :loading="updating">
                <span class="flex items-center gap-1.5">
                  <Icon name="mdi:content-save-outline" class="h-4 w-4" />
                  <span>保存</span>
                </span>
              </UButton>
            </div>
          </UForm>
        </UCard>
      </template>
    </UModal>

    <UModal v-model:open="deleteModalOpen">
      <template #content>
        <UCard class="w-full max-w-xl">
          <template #header>
            <div class="flex items-start justify-between">
              <div>
                <p class="text-sm text-error-500">
                  删除确认
                </p>
                <h3 class="text-lg font-semibold">
                  确认删除这条记录吗？
                </h3>
                <p class="text-xs text-neutral-500">
                  删除后将无法恢复，请确认。
                </p>
              </div>
              <UButton variant="ghost" color="neutral" @click="deleteModalOpen = false">
                <span class="flex items-center gap-1.5">
                  <Icon name="mdi:close" class="h-4 w-4" />
                  <span>关闭</span>
                </span>
              </UButton>
            </div>
          </template>
          <div class="space-y-3">
            <p class="text-sm">
              标题：<span class="font-medium">{{ deleteTarget?.title || '未命名' }}</span>
            </p>
            <p class="text-sm text-neutral-600">
              创建时间：{{ deleteTarget ? formatDateTime(deleteTarget.createdAt) : '' }}
            </p>
          </div>
          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton variant="ghost" color="neutral" @click="deleteModalOpen = false">
                <span class="flex items-center gap-1.5">
                  <Icon name="mdi:arrow-left" class="h-4 w-4" />
                  <span>取消</span>
                </span>
              </UButton>
              <UButton color="error" :loading="deletingId !== null" @click="confirmDelete">
                <span class="flex items-center gap-1.5">
                  <Icon name="mdi:trash-can-outline" class="h-4 w-4" />
                  <span>确认删除</span>
                </span>
              </UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </div>
</template>
