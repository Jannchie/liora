import { describe, expect, it } from 'vitest'
import { requirePositiveInt, requirePositiveIntRouterParam } from '../../../server/utils/route-params'

describe('server/utils/route-params', () => {
  it('accepts positive integers from numbers and strings', () => {
    expect(requirePositiveInt(1, 'Invalid id')).toBe(1)
    expect(requirePositiveInt('42', 'Invalid id')).toBe(42)
  })

  it('throws for invalid values', () => {
    expect(() => requirePositiveInt(0, 'Invalid id')).toThrowError('Invalid id')
    expect(() => requirePositiveInt(-1, 'Invalid id')).toThrowError('Invalid id')
    expect(() => requirePositiveInt('abc', 'Invalid id')).toThrowError('Invalid id')
  })

  it('reads router params and validates as positive integer', () => {
    const event = {
      context: {
        params: {
          id: '7',
        },
      },
    }
    expect(requirePositiveIntRouterParam(event as never, 'id', 'Invalid file id.')).toBe(7)
    expect(() => requirePositiveIntRouterParam({ context: { params: {} } } as never, 'id', 'Invalid file id.')).toThrowError('Invalid file id.')
  })
})
