import { describe, expect, it } from 'vitest'
import {
  normalizeSeriesDescription,
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
    expect(parseSeriesPagination({ limit: 2, offset: 0 })).toEqual({ limit: 2, offset: 0 })
    expect(parseSeriesPagination({ limit: 1.5, offset: true })).toEqual({ limit: null, offset: null })
    expect(parseSeriesPagination({ limit: [' ', '6'], offset: [7] })).toEqual({ limit: 6, offset: 7 })
    expect(parseSeriesPagination({ limit: [false], offset: {} })).toEqual({ limit: null, offset: null })
  })

  it('normalizes series slugs', () => {
    expect(slugifySeriesTitle('Hello World!')).toBe('hello-world')
    expect(normalizeSeriesSlug('  Portrait / 2026  ')).toBe('portrait-2026')
    expect(normalizeSeriesDescription('  hello  ')).toBe('hello')
    expect(normalizeSeriesDescription(null)).toBe('')
  })

  it('parses file id payloads', () => {
    expect(parseUniqueFileIds([1, '2', 'x', 2])).toEqual([1, 2])
    expect(parseUniqueFileIds('not-an-array')).toEqual([])
  })

  it('parses reorder payloads', () => {
    expect(parseSeriesReorderItems([
      { fileId: 3, sortOrder: 0 },
      { fileId: '4', sortOrder: '2' },
      { fileId: 'x', sortOrder: 1 },
      null,
      'bad',
    ])).toEqual([
      { fileId: 3, sortOrder: 0 },
      { fileId: 4, sortOrder: 2 },
    ])
    expect(parseSeriesReorderItems('not-an-array')).toEqual([])
  })
})
