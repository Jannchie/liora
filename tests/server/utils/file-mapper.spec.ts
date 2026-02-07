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
})
