import { describe, expect, it } from 'vitest'
import { resolveCameraBrand } from '../../../app/utils/camera-brand'

describe('resolve camera brand', () => {
  it('strips the brand down to the bare model when a logo carries the brand', () => {
    expect(resolveCameraBrand('SONY ILCE-7CM2')).toEqual({
      model: '7CM2',
      brandIcon: 'sony',
      brandLabel: 'Sony',
    })
  })

  it('keeps the model prefix for brands simple-icons has no logo for', () => {
    // Without a logo the label is all the reader has, so only the first
    // matched prefix goes — "EOS" has to survive.
    expect(resolveCameraBrand('Canon EOS R5')).toEqual({
      model: 'EOS R5',
      brandIcon: null,
      brandLabel: 'Canon',
    })
  })

  it('matches on a model pattern when no keyword appears', () => {
    expect(resolveCameraBrand('RICOH GR III')).toMatchObject({ brandLabel: 'Ricoh', brandIcon: null })
    expect(resolveCameraBrand('DJI FC3582')).toMatchObject({ brandLabel: 'DJI', brandIcon: 'dji' })
  })

  it('passes an unrecognised camera through untouched', () => {
    expect(resolveCameraBrand('Unknown Camera 9000')).toEqual({
      model: 'Unknown Camera 9000',
      brandIcon: null,
      brandLabel: null,
    })
  })

  it('treats blank input as no camera', () => {
    expect(resolveCameraBrand('   ')).toEqual({ model: undefined, brandIcon: null, brandLabel: null })
    expect(resolveCameraBrand(undefined)).toEqual({ model: undefined, brandIcon: null, brandLabel: null })
  })
})
