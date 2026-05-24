import { describe, expect, it } from 'vitest'
import {
  normalizeOptionalCharacters,
  normalizeOptionalText,
  parseOptionalNullableNumber,
  parseOptionalPositiveNumber,
  requireNullableNumber,
  requirePositiveNumber,
  requireTrimmedString,
} from '../../../../server/domain/files/field-parsers'

describe('server/domain/files/field-parsers', () => {
  it('keeps the fallback for optional text when undefined and trims otherwise', () => {
    expect(normalizeOptionalText(undefined, 'fallback')).toBe('fallback')
    expect(normalizeOptionalText('  hello  ', 'fallback')).toBe('hello')
  })

  it('trims required strings', () => {
    expect(requireTrimmedString('  hi ', 'title')).toBe('hi')
  })

  it('rejects non-string required values with a 400 and a readable message', () => {
    expect(() => requireTrimmedString(42, 'title')).toThrowError('title must be a string.')
    try {
      requireTrimmedString(42, 'title')
    }
    catch (error) {
      expect((error as { statusCode?: number }).statusCode).toBe(400)
    }
  })

  it('keeps the fallback for optional positive numbers and coerces strings', () => {
    expect(parseOptionalPositiveNumber(undefined, 100, 'Width')).toBe(100)
    expect(parseOptionalPositiveNumber('200', 100, 'Width')).toBe(200)
  })

  it('rejects zero and negatives for positive numbers', () => {
    expect(() => parseOptionalPositiveNumber(0, 100, 'Width')).toThrowError('Width must be a positive number.')
    expect(() => requirePositiveNumber(-5, 'width')).toThrowError('width must be a positive number.')
    expect(() => requirePositiveNumber('abc', 'width')).toThrowError('width must be a positive number.')
  })

  it('coerces required positive numbers from numbers and numeric strings', () => {
    expect(requirePositiveNumber(3, 'width')).toBe(3)
    expect(requirePositiveNumber('3', 'width')).toBe(3)
  })

  it('keeps the fallback for optional nullable numbers and honours explicit null', () => {
    expect(parseOptionalNullableNumber(undefined, 12, 'Latitude')).toBe(12)
    expect(parseOptionalNullableNumber(null, 12, 'Latitude')).toBeNull()
    expect(parseOptionalNullableNumber('0', 12, 'Latitude')).toBe(0)
  })

  it('rejects invalid nullable numbers', () => {
    expect(() => parseOptionalNullableNumber('abc', 12, 'Latitude')).toThrowError('Latitude must be a valid number.')
    expect(() => requireNullableNumber('x', 'latitude')).toThrowError('latitude must be a valid number.')
  })

  it('accepts null and zero for required nullable numbers', () => {
    expect(requireNullableNumber(null, 'latitude')).toBeNull()
    expect(requireNullableNumber(0, 'latitude')).toBe(0)
  })

  it('keeps the fallback for optional characters when undefined', () => {
    expect(normalizeOptionalCharacters(undefined, ['a'])).toEqual(['a'])
  })

  it('splits comma, fullwidth-comma and newline separated character strings', () => {
    expect(normalizeOptionalCharacters('a, b，c\nd', [])).toEqual(['a', 'b', 'c', 'd'])
  })

  it('filters out empty entries from character arrays', () => {
    expect(normalizeOptionalCharacters([' a ', '', 'b'], [])).toEqual(['a', 'b'])
  })
})
