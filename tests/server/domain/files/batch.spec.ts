import { describe, expect, it } from 'vitest'
import {
  parseBatchFieldMask,
  parseBatchFileIds,
  parseBatchMetadataPayload,
  parseBatchSeriesPayload,
  parseBatchUploadPayload,
  pickMaskedChanges,
} from '../../../../server/domain/files/batch'

describe('domain/files/batch', () => {
  it('parses batch file ids with uniqueness validation', () => {
    expect(parseBatchFileIds([1, '2', 3])).toEqual([1, 2, 3])
    expect(() => parseBatchFileIds([])).toThrowError('must contain at least one valid id')
    expect(() => parseBatchFileIds([1, 1])).toThrowError('must contain unique positive ids')
    expect(() => parseBatchFileIds(['x'])).toThrowError('must contain at least one valid id')
  })

  it('parses and validates field masks', () => {
    expect(parseBatchFieldMask(['title', 'notes'])).toEqual(['title', 'notes'])
    expect(() => parseBatchFieldMask(['title', 'title'])).toThrowError('unique supported fields')
    expect(() => parseBatchFieldMask(['unknown'])).toThrowError('at least one valid field')
  })

  it('parses batch metadata payload and enforces masked values', () => {
    const parsed = parseBatchMetadataPayload({
      fileIds: [1, 2],
      fieldMask: ['title', 'notes'],
      changes: {
        title: ' New title ',
        notes: '  memo ',
        description: 'ignore',
      },
    })
    expect(parsed.fileIds).toEqual([1, 2])
    expect(parsed.fieldMask).toEqual(['title', 'notes'])
    expect(pickMaskedChanges(parsed.changes, parsed.fieldMask)).toEqual({
      title: ' New title ',
      notes: '  memo ',
    })

    expect(() => parseBatchMetadataPayload({
      fileIds: [1],
      fieldMask: ['title'],
      changes: { notes: 'x' },
    })).toThrowError('changes.title is required')
  })

  it('parses batch series payload', () => {
    const payload = parseBatchSeriesPayload({
      fileIds: [3, 5],
      seriesId: 9,
      action: 'add',
    })
    expect(payload).toEqual({
      fileIds: [3, 5],
      seriesId: 9,
      action: 'add',
    })

    expect(() => parseBatchSeriesPayload({
      fileIds: [1],
      seriesId: 2,
      action: 'remove' as 'add',
    })).toThrowError('action must be add')
  })

  it('parses batch upload payload', () => {
    const parsed = parseBatchUploadPayload({
      fieldMask: ['title'],
      sharedChanges: {
        title: 'Batch title',
      },
      items: [
        { imageKey: 'a.jpg' },
        { imageKey: 'b.jpg', originalName: 'raw-name.jpg', metadataOverrides: { notes: 'item note' } },
      ],
    })
    expect(parsed.items).toHaveLength(2)
    expect(parsed.items[1]?.metadataOverrides?.notes).toBe('item note')

    expect(() => parseBatchUploadPayload({
      fieldMask: ['title'],
      sharedChanges: {},
      items: [{ imageKey: 'a.jpg' }],
    })).toThrowError('sharedChanges.title is required')
  })
})
