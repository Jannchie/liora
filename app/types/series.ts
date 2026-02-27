import type { FileSummary } from './file'

export interface SeriesSummary {
  id: number
  slug: string
  title: string
  description: string
  coverFileId: number | null
  cover: FileSummary | null
  fileCount: number
  isVirtual?: boolean
  createdAt: string
  updatedAt: string
}

export interface SeriesDetail extends SeriesSummary {
  files: FileSummary[]
}

export interface SeriesUpsertPayload {
  title: string
  slug?: string
  description?: string
  coverFileId?: number | null
}

export interface SeriesFileAssignPayload {
  fileIds: number[]
}

export interface FileSeriesUpdatePayload {
  seriesIds: number[]
}

export interface SeriesReorderPayload {
  items: Array<{
    fileId: number
    sortOrder: number
  }>
}
