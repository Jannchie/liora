import { describe, expect, it } from 'vitest'
import {
  normalizeSeriesSlug,
  parseSeriesPagination,
  parseSeriesReorderItems,
  parseUniqueFileIds,
  slugifySeriesTitle,
} from '../../../../server/domain/series/service'

describe('domain/series/service', () => {
  it('parses pagination query safely', () => {
    expect(parseSeriesPagination({ limit: '12', offset: '4' })).toEqual({ limit: 12, offset: 4 })
    expect(parseSeriesPagination({ limit: '-1', offset: [] })).toEqual({ limit: null, offset: null })
  })

  it('normalizes series slugs', () => {
    expect(slugifySeriesTitle('Hello World!')).toBe('hello-world')
    expect(normalizeSeriesSlug('  Portrait / 2026  ')).toBe('portrait-2026')
  })

  it('parses file id payloads', () => {
    expect(parseUniqueFileIds([1, '2', 'x', 2])).toEqual([1, 2])
  })

  it('parses reorder payloads', () => {
    expect(parseSeriesReorderItems([
      { fileId: 3, sortOrder: 0 },
      { fileId: '4', sortOrder: '2' },
      { fileId: 'x', sortOrder: 1 },
    ])).toEqual([
      { fileId: 3, sortOrder: 0 },
      { fileId: 4, sortOrder: 2 },
    ])
  })
})
