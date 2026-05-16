import { describe, expect, it } from 'vitest'
import { parseListQuery, toWaterfallSummary } from '../../../../server/domain/files/listing'

describe('domain/files/listing', () => {
  it('parses list query with fallbacks', () => {
    expect(parseListQuery({
      limit: '10',
      offset: '3',
      waterfall: 'true',
    })).toEqual({
      limit: 10,
      offset: 3,
      waterfallOnly: true,
    })
    expect(parseListQuery({
      limit: '-1',
      offset: [],
      waterfall: '0',
    })).toEqual({
      limit: null,
      offset: null,
      waterfallOnly: false,
    })
  })

  it('parses query values from arrays and numbers', () => {
    expect(parseListQuery({
      limit: ['', '12'],
      offset: [8, false],
      waterfall: 1,
    })).toEqual({
      limit: 12,
      offset: 8,
      waterfallOnly: true,
    })
    expect(parseListQuery({
      limit: [' ', null],
      offset: ['-1'],
      waterfall: ['no'],
    })).toEqual({
      limit: null,
      offset: null,
      waterfallOnly: false,
    })
    expect(parseListQuery({
      limit: true,
      offset: Number.POSITIVE_INFINITY,
      waterfall: { enabled: true },
    })).toEqual({
      limit: null,
      offset: null,
      waterfallOnly: false,
    })
    expect(parseListQuery({
      limit: [Number.POSITIVE_INFINITY, 5],
      offset: [Number.NaN, '2'],
      waterfall: [false, '1'],
    })).toEqual({
      limit: 5,
      offset: 2,
      waterfallOnly: false,
    })
  })

  it('maps waterfall summary from metadata payload', () => {
    const summary = toWaterfallSummary({
      id: 1,
      imageUrl: 'https://example.com/a.jpg',
      width: 100,
      height: 50,
      metadata: JSON.stringify({
        arthash: 'abc',
        livePhotoVideoUrl: 'https://example.com/a.mp4',
      }),
    })
    expect(summary.arthash).toBe('abc')
    expect(summary.livePhotoVideoUrl).toBe('https://example.com/a.mp4')
  })

  it('handles invalid metadata payload in waterfall summary', () => {
    const summary = toWaterfallSummary({
      id: 2,
      imageUrl: null,
      width: 200,
      height: 100,
      metadata: '{not-json}',
    })
    expect(summary).toEqual({
      id: 2,
      imageUrl: '',
      width: 200,
      height: 100,
      arthash: undefined,
      livePhotoVideoUrl: undefined,
    })
  })

  it('handles empty metadata and non-string live photo url', () => {
    const summary = toWaterfallSummary({
      id: 3,
      imageUrl: 'https://example.com/c.jpg',
      width: 320,
      height: 180,
      metadata: '',
    })
    expect(summary.arthash).toBeUndefined()
    expect(summary.livePhotoVideoUrl).toBeUndefined()

    const nonStringVideo = toWaterfallSummary({
      id: 4,
      imageUrl: 'https://example.com/d.jpg',
      width: 320,
      height: 180,
      metadata: JSON.stringify({
        arthash: 123,
        livePhotoVideoUrl: 456,
      }),
    })
    expect(nonStringVideo.arthash).toBeUndefined()
    expect(nonStringVideo.livePhotoVideoUrl).toBeUndefined()
  })
})
