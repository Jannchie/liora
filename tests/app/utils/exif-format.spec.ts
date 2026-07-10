import { describe, expect, it } from 'vitest'
import {
  formatAperture,
  formatCaptureTime,
  formatColorSpace,
  formatExposureBias,
  formatFocal,
  formatLocation,
  formatResolutionUnit,
  formatResolutionValue,
  formatShutter,
  normalizeToOption,
  textFrom,
} from '../../../app/utils/exif-format'

describe('app/utils/exif-format', () => {
  describe('normalizetooption', () => {
    const objectOptions = [
      { label: 'Pattern', value: 'Pattern' },
      { label: 'Center-weighted', value: 'Center-weighted' },
      { label: 'Spot', value: 'Spot' },
    ]
    const stringOptions = ['Pattern', 'Center-weighted', 'Spot']

    it('returns empty string for undefined, empty, or whitespace-only input', () => {
      expect(normalizeToOption(undefined, stringOptions)).toBe('')
      expect(normalizeToOption('', stringOptions)).toBe('')
      expect(normalizeToOption('   ', stringOptions)).toBe('')
    })

    it('matches option values case-insensitively for string options', () => {
      expect(normalizeToOption('pattern', stringOptions)).toBe('Pattern')
      expect(normalizeToOption('SPOT', stringOptions)).toBe('Spot')
    })

    it('matches option values case-insensitively for object options', () => {
      expect(normalizeToOption('pattern', objectOptions)).toBe('Pattern')
      expect(normalizeToOption('center-WEIGHTED', objectOptions)).toBe('Center-weighted')
    })

    it('resolves exact alias matches before option matching', () => {
      expect(normalizeToOption('matrix', stringOptions, { matrix: 'Pattern' })).toBe('Pattern')
      expect(normalizeToOption('Matrix', objectOptions, { matrix: 'Pattern' })).toBe('Pattern')
    })

    it('resolves substring alias matches when no exact option matches', () => {
      expect(normalizeToOption('auto, did not fire', ['Fired', 'Did not fire'], {
        'auto, did not fire': 'Auto (did not fire)',
      })).toBe('Auto (did not fire)')
      expect(normalizeToOption('metering: matrix mode', stringOptions, { matrix: 'Pattern' })).toBe('Pattern')
    })

    it('falls back to partial option match, then to the trimmed input', () => {
      expect(normalizeToOption('mode: spot metering', stringOptions)).toBe('Spot')
      expect(normalizeToOption('  Something Unknown  ', stringOptions)).toBe('Something Unknown')
    })

    it('prefers exact option matches over substring aliases', () => {
      expect(normalizeToOption('Pattern', stringOptions, { pat: 'Spot' })).toBe('Pattern')
    })
  })

  describe('formatlocation', () => {
    it('formats a coordinate pair to six decimal places', () => {
      expect(formatLocation(35.658_581, 139.745_433)).toBe('35.658581, 139.745433')
      expect(formatLocation(0, 0)).toBe('0.000000, 0.000000')
    })

    it('returns empty string when either coordinate is missing', () => {
      expect(formatLocation(undefined, 139.745_433)).toBe('')
      expect(formatLocation(35.658_581, undefined)).toBe('')
      expect(formatLocation(undefined, undefined)).toBe('')
    })
  })

  describe('textfrom', () => {
    it('joins array values with a space (software/keywords arrays)', () => {
      expect(textFrom(['Adobe Lightroom', '7.1'])).toBe('Adobe Lightroom 7.1')
    })

    it('passes strings through and maps undefined to empty string', () => {
      expect(textFrom('Darktable')).toBe('Darktable')
      expect(textFrom(undefined)).toBe('')
    })
  })

  describe('formataperture', () => {
    it('formats f-number with one decimal', () => {
      expect(formatAperture(1.8)).toBe('f/1.8')
      expect(formatAperture(8)).toBe('f/8.0')
    })

    it('returns empty string for missing, zero, or negative values', () => {
      expect(formatAperture(undefined)).toBe('')
      expect(formatAperture(0)).toBe('')
      expect(formatAperture(-2)).toBe('')
    })
  })

  describe('formatshutter', () => {
    it('formats sub-second exposure times as fractions', () => {
      expect(formatShutter(0.005)).toBe('1/200s')
      expect(formatShutter(1 / 125)).toBe('1/125s')
    })

    it('formats exposure times of one second or longer as decimals', () => {
      expect(formatShutter(1)).toBe('1.00s')
      expect(formatShutter(2.5)).toBe('2.50s')
    })

    it('falls back to apex shutter speed value when exposure time is missing', () => {
      expect(formatShutter(undefined, 7)).toBe('1/128s')
      expect(formatShutter(undefined, -1)).toBe('2.00s')
      expect(formatShutter(undefined, 0)).toBe('1.00s')
    })

    it('returns empty string when both inputs are missing or invalid', () => {
      expect(formatShutter()).toBe('')
      expect(formatShutter(0)).toBe('')
      expect(formatShutter(-1)).toBe('')
    })
  })

  describe('formatfocal', () => {
    it('rounds focal length to whole millimeters', () => {
      expect(formatFocal(35)).toBe('35mm')
      expect(formatFocal(23.7)).toBe('24mm')
    })

    it('returns empty string for missing, zero, or negative values', () => {
      expect(formatFocal(undefined)).toBe('')
      expect(formatFocal(0)).toBe('')
      expect(formatFocal(-50)).toBe('')
    })
  })

  describe('formatexposurebias', () => {
    it('formats numeric bias with sign and ev suffix', () => {
      expect(formatExposureBias(0.33)).toBe('+0.3 EV')
      expect(formatExposureBias(-1)).toBe('-1.0 EV')
      expect(formatExposureBias(0)).toBe('0.0 EV')
    })

    it('parses numeric strings', () => {
      expect(formatExposureBias('0.7')).toBe('+0.7 EV')
      expect(formatExposureBias('-0.67')).toBe('-0.7 EV')
    })

    it('passes non-numeric strings through trimmed', () => {
      expect(formatExposureBias(' +2/3 EV ')).toBe('+2/3 EV')
    })

    it('returns empty string for undefined input', () => {
      expect(formatExposureBias(undefined)).toBe('')
    })

    it('treats whitespace-only strings as numeric zero (legacy behavior)', () => {
      expect(formatExposureBias('   ')).toBe('0.0 EV')
    })
  })

  describe('formatresolutionvalue', () => {
    it('formats integers without decimals', () => {
      expect(formatResolutionValue(72)).toBe('72')
      expect(formatResolutionValue('300')).toBe('300')
    })

    it('trims trailing zeros from fractional values', () => {
      expect(formatResolutionValue(72.5)).toBe('72.5')
      expect(formatResolutionValue(180.099)).toBe('180.1')
    })

    it('returns non-numeric strings as-is and empty string for undefined', () => {
      expect(formatResolutionValue('unknown')).toBe('unknown')
      expect(formatResolutionValue(undefined)).toBe('')
    })
  })

  describe('formatresolutionunit', () => {
    it('maps exif unit codes to labels', () => {
      expect(formatResolutionUnit(2)).toBe('Pixels/Inch')
      expect(formatResolutionUnit(3)).toBe('Pixels/Centimeter')
      expect(formatResolutionUnit('2')).toBe('Pixels/Inch')
    })

    it('stringifies unknown codes and returns empty string for undefined', () => {
      expect(formatResolutionUnit(5)).toBe('5')
      expect(formatResolutionUnit(undefined)).toBe('')
    })
  })

  describe('formatcolorspace', () => {
    it('maps known exif color space codes', () => {
      expect(formatColorSpace(1)).toBe('sRGB')
      expect(formatColorSpace(65_535)).toBe('Uncalibrated')
      expect(formatColorSpace('1')).toBe('sRGB')
    })

    it('passes text values through trimmed', () => {
      expect(formatColorSpace(' Adobe RGB ')).toBe('Adobe RGB')
    })

    it('returns empty string for undefined or whitespace-only input', () => {
      expect(formatColorSpace(undefined)).toBe('')
      expect(formatColorSpace('   ')).toBe('')
    })
  })

  describe('formatcapturetime', () => {
    it('converts strings and date objects to iso strings', () => {
      expect(formatCaptureTime('2024-05-01T10:30:00Z')).toBe('2024-05-01T10:30:00.000Z')
      expect(formatCaptureTime(new Date(Date.UTC(2024, 4, 1, 10, 30)))).toBe('2024-05-01T10:30:00.000Z')
    })

    it('returns empty string for missing or invalid dates', () => {
      expect(formatCaptureTime(undefined)).toBe('')
      expect(formatCaptureTime('')).toBe('')
      expect(formatCaptureTime('not a date')).toBe('')
    })
  })
})
