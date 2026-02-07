import { describe, expect, it } from 'vitest'
import {
  assertContentTypePrefix,
  assertMaxFileSize,
  assertPresignFile,
  buildImageKey,
  buildVideoKey,
  MAX_FILE_SIZE_BYTES,
  parseDirectBody,
} from '../../../../server/domain/files/upload'

describe('domain/files/upload', () => {
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
})
