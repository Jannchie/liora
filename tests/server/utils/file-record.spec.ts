import { beforeEach, describe, expect, it, vi } from 'vitest'
import { findFileById, requireFileById, requireFileFromRouterParam } from '../../../server/utils/file-record'

const { mockEq, mockFindFirst, mockRequirePositiveIntRouterParam } = vi.hoisted(() => ({
  mockEq: vi.fn((left: unknown, right: unknown) => ({ left, right })),
  mockFindFirst: vi.fn(),
  mockRequirePositiveIntRouterParam: vi.fn(),
}))

vi.mock('drizzle-orm', () => ({
  eq: mockEq,
}))

vi.mock('../../../server/utils/db', () => ({
  db: {
    query: {
      files: {
        findFirst: mockFindFirst,
      },
    },
  },
  files: {
    id: 'file-id-column',
  },
}))

vi.mock('../../../server/utils/route-params', () => ({
  requirePositiveIntRouterParam: mockRequirePositiveIntRouterParam,
}))

describe('server/utils/file-record', () => {
  beforeEach(() => {
    mockEq.mockClear()
    mockFindFirst.mockReset()
    mockRequirePositiveIntRouterParam.mockReset()
  })

  it('finds file by id using drizzle eq condition', async () => {
    const expected = { id: 11, title: 'a' }
    mockFindFirst.mockResolvedValueOnce(expected)

    const result = await findFileById(11)

    expect(mockEq).toHaveBeenCalledWith('file-id-column', 11)
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: {
        left: 'file-id-column',
        right: 11,
      },
    })
    expect(result).toEqual(expected)
  })

  it('requires existing file by id', async () => {
    mockFindFirst.mockResolvedValueOnce(undefined)
    await expect(requireFileById(9)).rejects.toMatchObject({
      statusCode: 404,
      statusMessage: 'File not found.',
    })
  })

  it('reads id from router params before requiring file', async () => {
    const event = { context: { params: { id: '5' } } }
    mockRequirePositiveIntRouterParam.mockReturnValueOnce(5)
    mockFindFirst.mockResolvedValueOnce({ id: 5 })

    const result = await requireFileFromRouterParam(event as never, 'id', 'Invalid file id.')

    expect(mockRequirePositiveIntRouterParam).toHaveBeenCalledWith(event, 'id', 'Invalid file id.')
    expect(result).toEqual({ id: 5 })
  })
})
