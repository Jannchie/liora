import type { H3Event } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  assertContentTypePrefix,
  assertMaxFileSize,
  assertPresignFile,
  buildImageKey,
  buildVideoKey,
  isMultipartRequest,
  MAX_FILE_SIZE_BYTES,
  parseDirectBody,
  parseMultipart,
} from '../../../../server/domain/files/upload'

const { mockReadMultipartFormData } = vi.hoisted(() => ({
  mockReadMultipartFormData: vi.fn(),
}))

vi.mock('h3', async () => {
  const actual = await vi.importActual<typeof import('h3')>('h3')
  return {
    ...actual,
    readMultipartFormData: mockReadMultipartFormData,
  }
})

describe('domain/files/upload', () => {
  beforeEach(() => {
    mockReadMultipartFormData.mockReset()
  })

  it('builds normalized image and video keys', () => {
    const imageKey = buildImageKey('测试 文件 @1.JPG')
    const videoKey = buildVideoKey('clip.mov')
    expect(imageKey).toMatch(/\.jpg$/)
    expect(videoKey).toMatch(/\.mov$/)
    expect(imageKey).not.toContain(' ')
  })

  it('validates presign file constraints', () => {
    const valid = assertPresignFile({
      filename: 'a.jpg',
      contentType: 'image/jpeg',
      size: 1024,
    }, 'Image')
    expect(valid.contentType).toBe('image/jpeg')
    expect(() => assertMaxFileSize(MAX_FILE_SIZE_BYTES + 1, 'Image')).toThrowError()
    expect(() => assertContentTypePrefix('text/plain', 'image/', 'Image contentType')).toThrowError()
    expect(() => assertPresignFile({
      filename: '',
      contentType: 'image/jpeg',
      size: 1,
    }, 'Image')).toThrowError('Image filename is required.')
    expect(() => assertPresignFile({
      filename: 'a.jpg',
      contentType: '',
      size: 1,
    }, 'Image')).toThrowError('Image contentType is required.')
    expect(() => assertPresignFile({
      filename: 'a.jpg',
      contentType: 'image/jpeg',
      size: 0,
    }, 'Image')).toThrowError('Image size is invalid.')
  })

  it('parses direct upload body into normalized fields', () => {
    const parsed = parseDirectBody({
      imageKey: 'images/file.jpg',
      title: ' title ',
      characters: ['A', 'B'],
      latitude: 1.23,
      longitude: 2.34,
    })
    expect(parsed.imageKey).toBe('images/file.jpg')
    expect(parsed.originalName).toBe('file.jpg')
    expect(parsed.fields.title).toBe(' title ')
    expect(parsed.fields.characters).toBe('A, B')
    expect(parsed.fields.latitude).toBe('1.23')
  })

  it('rejects invalid direct upload body payload', () => {
    expect(() => parseDirectBody(undefined)).toThrowError('Request body is required.')
    expect(() => parseDirectBody({
      imageKey: '/abs/path.jpg',
    })).toThrowError('imageKey is invalid.')
    expect(() => parseDirectBody({
      imageKey: 'ok.jpg',
      videoKey: '../bad.mov',
    })).toThrowError('videoKey is invalid.')
  })

  it('validates multipart content-type header', () => {
    const multipartEvent = {
      node: {
        req: {
          headers: {
            'content-type': 'multipart/form-data; boundary=abc',
          },
        },
      },
    }
    const jsonEvent = {
      node: {
        req: {
          headers: {
            'content-type': 'application/json',
          },
        },
      },
    }
    expect(isMultipartRequest(multipartEvent as H3Event)).toBe(true)
    expect(isMultipartRequest(jsonEvent as H3Event)).toBe(false)
  })

  it('parses multipart payload with image, optional video and fields', async () => {
    mockReadMultipartFormData.mockResolvedValueOnce([
      {
        name: 'title',
        data: Buffer.from('demo', 'utf8'),
      },
      {
        name: 'video',
        filename: 'clip.mov',
        data: Buffer.from([1, 2, 3]),
      },
      {
        name: 'file',
        filename: 'image.jpg',
        data: Buffer.from([4, 5, 6]),
      },
    ])
    const parsed = await parseMultipart({} as H3Event)
    expect(parsed.fields.title).toBe('demo')
    expect(parsed.image.filename).toBe('image.jpg')
    expect(parsed.video?.filename).toBe('clip.mov')
  })

  it('rejects when multipart form data is missing', async () => {
    mockReadMultipartFormData.mockResolvedValueOnce(null)
    await expect(parseMultipart({} as H3Event)).rejects.toThrowError('Multipart form data is required.')
  })

  it('rejects multipart payload without image data', async () => {
    mockReadMultipartFormData.mockResolvedValueOnce([
      {
        name: 'video',
        filename: 'clip.mov',
        data: Buffer.from([1]),
      },
    ])
    await expect(parseMultipart({} as H3Event)).rejects.toThrowError('Image file is required.')
  })

  it('drops empty video entry when parsing multipart payload', async () => {
    mockReadMultipartFormData.mockResolvedValueOnce([
      {
        name: 'video',
        filename: 'clip.mov',
        data: Buffer.alloc(0),
      },
      {
        name: 'image',
        filename: 'image.jpg',
        data: Buffer.from([1]),
      },
    ])
    const parsed = await parseMultipart({} as H3Event)
    expect(parsed.video).toBeUndefined()
  })
})
