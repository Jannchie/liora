import { describe, expect, it } from 'vitest'
import {
  buildMetadata,
  mergeMetadataTextUpdates,
  normalizeMetadataTextUpdates,
  parseCharacters,
  readMetadataTextValues,
  stripLensFromCamera,
  validateLengths,
} from '../../../../server/domain/files/metadata'

describe('domain/files/metadata', () => {
  it('parses character inputs consistently', () => {
    expect(parseCharacters('A, B，C\nD')).toEqual(['A', 'B', 'C', 'D'])
    expect(parseCharacters([' A ', ''])).toEqual(['A'])
  })

  it('extracts lens model from camera model string', () => {
    const deduped = stripLensFromCamera('Sony A7C / FE 35mm F1.8', '')
    expect(deduped.cameraModel).toBe('Sony A7C')
    expect(deduped.lensModel).toBe('FE 35mm F1.8')

    const removeKnownLens = stripLensFromCamera('Sony A7C / FE 35mm F1.8', 'FE 35mm F1.8')
    expect(removeKnownLens.cameraModel).toBe('Sony A7C / FE 35mm F1.8')
    expect(removeKnownLens.lensModel).toBe('FE 35mm F1.8')

    const noSeparator = stripLensFromCamera('Sony A7C', '')
    expect(noSeparator.cameraModel).toBe('Sony A7C')
    expect(noSeparator.lensModel).toBe('')
  })

  it('normalizes and merges metadata text fields', () => {
    const values = readMetadataTextValues({
      fanworkTitle: '  test  ',
      notes: undefined,
    })
    expect(values.fanworkTitle).toBe('test')
    expect(values.notes).toBe('')

    const updates = normalizeMetadataTextUpdates({
      fanworkTitle: '  New Work  ',
      notes: undefined,
      shutterSpeed: ' 1/100s ',
    })
    expect(updates).toEqual({
      fanworkTitle: 'New Work',
      shutterSpeed: '1/100s',
    })

    const base = buildMetadata({}, ['A'])
    base.fanworkTitle = 'Old Work'
    base.shutterSpeed = '1/50s'
    const merged = mergeMetadataTextUpdates(base, {
      fanworkTitle: '',
      shutterSpeed: '1/200s',
    }, {
      preserveOnEmpty: true,
    })
    expect(merged.fanworkTitle).toBe('Old Work')
    expect(merged.shutterSpeed).toBe('1/200s')

    const cleared = mergeMetadataTextUpdates(base, {
      fanworkTitle: '',
    })
    expect(cleared.fanworkTitle).toBe('')
  })

  it('builds metadata with validated live photo still time', () => {
    const withStillTime = buildMetadata({
      latitude: '35.6',
      longitude: '139.7',
      livePhotoStillTime: '1.5',
    }, [])
    expect(withStillTime.latitude).toBe(35.6)
    expect(withStillTime.longitude).toBe(139.7)
    expect(withStillTime.livePhotoStillTime).toBe(1.5)

    const invalidStillTime = buildMetadata({
      livePhotoStillTime: '-1',
    }, [])
    expect(invalidStillTime.livePhotoStillTime).toBeUndefined()
  })

  it('rejects fields that exceed length limits', () => {
    const metadata = buildMetadata({}, ['A'])
    metadata.notes = 'x'.repeat(5000)
    expect(() => validateLengths({
      title: '',
      description: '',
      genre: '',
      metadata,
      characters: ['A'],
      originalName: 'a.jpg',
    })).toThrowError()
  })

  it('rejects oversized character values and oversized character list', () => {
    const metadata = buildMetadata({}, [])
    expect(() => validateLengths({
      title: '',
      description: '',
      genre: '',
      metadata,
      characters: ['x'.repeat(121)],
      originalName: 'a.jpg',
    })).toThrowError('Character exceeds the maximum length')

    const longCharacters = Array.from({ length: 20 }, (_, index) => `character-${index.toString().padStart(2, '0')}`.repeat(10))
    expect(() => validateLengths({
      title: '',
      description: '',
      genre: '',
      metadata,
      characters: longCharacters,
      originalName: 'a.jpg',
    })).toThrowError('Character list exceeds the maximum length')
  })
})
