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

  it('maps waterfall summary from metadata payload', () => {
    const summary = toWaterfallSummary({
      id: 1,
      imageUrl: 'https://example.com/a.jpg',
      width: 100,
      height: 50,
      metadata: JSON.stringify({
        thumbhash: 'abc',
        livePhotoVideoUrl: 'https://example.com/a.mp4',
      }),
    })
    expect(summary.thumbhash).toBe('abc')
    expect(summary.livePhotoVideoUrl).toBe('https://example.com/a.mp4')
  })
})
