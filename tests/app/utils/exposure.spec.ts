import { describe, expect, it } from 'vitest'
import {
  normalizeExposureModeValue,
  normalizeExposureProgramValue,
  normalizeFlashValue,
  normalizeMeteringModeValue,
  normalizeWhiteBalanceValue,
} from '../../../app/utils/exposure'

describe('app/utils/exposure', () => {
  it('normalizes exposure program values from numbers and aliases', () => {
    expect(normalizeExposureProgramValue(3)).toBe('Aperture priority')
    expect(normalizeExposureProgramValue(99)).toBe('Program 99')
    expect(normalizeExposureProgramValue('normal_program')).toBe('Program')
    expect(normalizeExposureProgramValue('Custom Program')).toBe('Custom Program')
    expect(normalizeExposureProgramValue(undefined)).toBeUndefined()
  })

  it('normalizes exposure mode values from numbers and text', () => {
    expect(normalizeExposureModeValue(0)).toBe('Auto')
    expect(normalizeExposureModeValue(7)).toBe('Mode 7')
    expect(normalizeExposureModeValue('bracket')).toBe('Auto bracket')
    expect(normalizeExposureModeValue('Manual')).toBe('Manual')
    expect(normalizeExposureModeValue('   ')).toBe('Auto')
  })

  it('normalizes metering mode values including text synonyms', () => {
    expect(normalizeMeteringModeValue(5)).toBe('Pattern')
    expect(normalizeMeteringModeValue(9)).toBe('Mode 9')
    expect(normalizeMeteringModeValue('matrix')).toBe('Pattern')
    expect(normalizeMeteringModeValue('center weighted average')).toBe('Center-weighted')
  })

  it('normalizes white balance values', () => {
    expect(normalizeWhiteBalanceValue(0)).toBe('Auto')
    expect(normalizeWhiteBalanceValue(1)).toBe('Manual')
    expect(normalizeWhiteBalanceValue('  manual  ')).toBe('Manual')
    expect(normalizeWhiteBalanceValue('unknown')).toBe('unknown')
  })

  it('normalizes flash bitmask and text variants', () => {
    expect(normalizeFlashValue(0)).toBe('Did not fire')
    expect(normalizeFlashValue(1)).toBe('Fired')
    expect(normalizeFlashValue(24)).toBe('Auto (did not fire)')
    expect(normalizeFlashValue(25)).toBe('Auto (fired)')
    expect(normalizeFlashValue('auto, fired')).toBe('Auto (fired)')
    expect(normalizeFlashValue('manual mode')).toBe('manual mode')
    expect(normalizeFlashValue('   ')).toBe('Did not fire')
    expect(normalizeFlashValue(undefined)).toBeUndefined()
  })

  it('handles null-like runtime values defensively', () => {
    expect(normalizeExposureProgramValue(null as never)).toBeUndefined()
  })
})
