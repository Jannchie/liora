import { describe, expect, it } from 'vitest'
import { toFileResponse } from '../../../server/utils/file-mapper'

describe('server/utils/file-mapper', () => {
  it('falls back safely when metadata json is invalid', () => {
    const response = toFileResponse({
      id: 1,
      title: 'Title',
      description: 'Desc',
      imageUrl: 'https://example.com/a.jpg',
      width: 100,
      height: 200,
      originalName: 'a.jpg',
      fanworkTitle: 'FW',
      characterList: 'A, B',
      location: 'Loc',
      locationName: 'Loc Name',
      latitude: null,
      longitude: null,
      cameraModel: 'Camera',
      aperture: 'f/2.8',
      focalLength: '35mm',
      iso: '100',
      shutterSpeed: '1/100s',
      captureTime: '2026-01-01T00:00:00.000Z',
      metadata: '{invalid',
      genre: 'photo',
      createdAt: '2026-01-01T00:00:00.000Z',
    })

    expect(response.characters).toEqual(['A', 'B'])
    expect(response.metadata.fileSize).toBe(0)
    expect(response.fileSize).toBe(0)
  })

  it('round-trips authored recompose params through the metadata allowlist', () => {
    const recompose = {
      version: 1,
      rotate90: 1,
      flipH: false,
      flipV: false,
      straighten: 2.5,
      stretchX: 1,
      stretchY: 1,
      perspectiveH: 0.2,
      perspectiveV: 0,
      crop: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
      original: { width: 4000, height: 3000 },
    }
    const response = toFileResponse({
      id: 1,
      title: 'Title',
      description: 'Desc',
      imageUrl: 'https://example.com/a.jpg',
      width: 100,
      height: 200,
      originalName: 'a.jpg',
      fanworkTitle: 'FW',
      characterList: '',
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
      metadata: JSON.stringify({ recompose }),
      genre: '',
      createdAt: '2026-01-01T00:00:00.000Z',
    })

    expect(response.metadata.recompose).toEqual(recompose)
  })
})
