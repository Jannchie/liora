import type { MediaFormState } from '~/types/admin'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useExifExtraction } from '~/composables/useExifExtraction'
import { createEmptyMediaFormState } from '~/utils/media-form'

const parse = vi.fn()

vi.mock('exifr', () => ({
  default: {
    parse: (...args: unknown[]) => parse(...args),
  },
}))

vi.mock('~/composables/useExposureOptions', () => ({
  useExposureOptions: () => ({
    exposureProgramOptions: { value: [] },
    exposureModeOptions: { value: [] },
    meteringModeOptions: { value: [] },
    whiteBalanceOptions: { value: [] },
    flashOptions: { value: [] },
  }),
}))

function run(form: MediaFormState): Promise<{ errorMessage?: string }> {
  const { extractExif } = useExifExtraction()
  return extractExif({
    file: new File([], 'DSC00001.jpg'),
    token: 1,
    isActiveToken: () => true,
    form,
    captureTimeLocal: { value: '' },
    exifFailedFallback: 'failed',
  })
}

describe('composables/useexifextraction', () => {
  let form: MediaFormState

  beforeEach(() => {
    parse.mockReset()
    form = createEmptyMediaFormState()
  })

  it('puts gps into the coordinate fields and leaves the address fields alone', async () => {
    parse.mockResolvedValue({ latitude: 35.65858123, longitude: 139.74543387 })

    await run(form)

    expect(form.latitude).toBe(35.658581)
    expect(form.longitude).toBe(139.745434)
    // `location` is the postal address and `locationName` the place name;
    // both are filled by (reverse) geocoding, never by raw coordinates.
    expect(form.location).toBe('')
    expect(form.locationName).toBe('')
  })

  it('leaves coordinates untouched when the frame carries no gps', async () => {
    parse.mockResolvedValue({ Make: 'SONY', Model: 'ILCE-7CM2' })

    await run(form)

    expect(form.latitude).toBeNull()
    expect(form.longitude).toBeNull()
    expect(form.cameraModel).toBe('SONY ILCE-7CM2')
  })

  it('ignores unusable coordinate values', async () => {
    parse.mockResolvedValue({ latitude: Number.NaN, longitude: 139.745433 })

    await run(form)

    expect(form.latitude).toBeNull()
    expect(form.longitude).toBe(139.745433)
  })
})
