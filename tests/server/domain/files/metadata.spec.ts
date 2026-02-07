import { describe, expect, it } from 'vitest'
import { buildMetadata, parseCharacters, stripLensFromCamera, validateLengths } from '../../../../server/domain/files/metadata'

describe('domain/files/metadata', () => {
  it('parses character inputs consistently', () => {
    expect(parseCharacters('A, B，C\nD')).toEqual(['A', 'B', 'C', 'D'])
    expect(parseCharacters([' A ', ''])).toEqual(['A'])
  })

  it('extracts lens model from camera model string', () => {
    const deduped = stripLensFromCamera('Sony A7C / FE 35mm F1.8', '')
    expect(deduped.cameraModel).toBe('Sony A7C')
    expect(deduped.lensModel).toBe('FE 35mm F1.8')
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
})
