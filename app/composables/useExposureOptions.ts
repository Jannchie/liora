import type { ComputedRef } from 'vue'
import { computed } from 'vue'

interface SelectOption {
  label: string
  value: string
}

export function useExposureOptions(): {
  exposureProgramOptions: ComputedRef<SelectOption[]>
  exposureModeOptions: ComputedRef<SelectOption[]>
  meteringModeOptions: ComputedRef<SelectOption[]>
  whiteBalanceOptions: ComputedRef<SelectOption[]>
  flashOptions: ComputedRef<SelectOption[]>
} {
  const { t } = useI18n()

  const exposureProgramOptions = computed<SelectOption[]>(() => [
    { label: t('admin.upload.options.exposureProgram.notDefined'), value: 'Not defined' },
    { label: t('admin.upload.options.exposureProgram.manual'), value: 'Manual' },
    { label: t('admin.upload.options.exposureProgram.program'), value: 'Program' },
    { label: t('admin.upload.options.exposureProgram.aperturePriority'), value: 'Aperture priority' },
    { label: t('admin.upload.options.exposureProgram.shutterPriority'), value: 'Shutter priority' },
    { label: t('admin.upload.options.exposureProgram.creative'), value: 'Creative' },
    { label: t('admin.upload.options.exposureProgram.action'), value: 'Action' },
    { label: t('admin.upload.options.exposureProgram.portrait'), value: 'Portrait' },
    { label: t('admin.upload.options.exposureProgram.landscape'), value: 'Landscape' },
  ])

  const exposureModeOptions = computed<SelectOption[]>(() => [
    { label: t('admin.upload.options.exposureMode.auto'), value: 'Auto' },
    { label: t('admin.upload.options.exposureMode.manual'), value: 'Manual' },
    { label: t('admin.upload.options.exposureMode.bracket'), value: 'Auto bracket' },
  ])

  const meteringModeOptions = computed<SelectOption[]>(() => [
    { label: t('admin.upload.options.metering.unknown'), value: 'Unknown' },
    { label: t('admin.upload.options.metering.average'), value: 'Average' },
    { label: t('admin.upload.options.metering.center'), value: 'Center-weighted' },
    { label: t('admin.upload.options.metering.spot'), value: 'Spot' },
    { label: t('admin.upload.options.metering.multiSpot'), value: 'Multi-spot' },
    { label: t('admin.upload.options.metering.pattern'), value: 'Pattern' },
    { label: t('admin.upload.options.metering.partial'), value: 'Partial' },
    { label: t('admin.upload.options.metering.other'), value: 'Other' },
  ])

  const whiteBalanceOptions = computed<SelectOption[]>(() => [
    { label: t('admin.upload.options.whiteBalance.auto'), value: 'Auto' },
    { label: t('admin.upload.options.whiteBalance.manual'), value: 'Manual' },
  ])

  const flashOptions = computed<SelectOption[]>(() => [
    { label: t('admin.upload.options.flash.didNotFire'), value: 'Did not fire' },
    { label: t('admin.upload.options.flash.autoDidNotFire'), value: 'Auto (did not fire)' },
    { label: t('admin.upload.options.flash.fired'), value: 'Fired' },
    { label: t('admin.upload.options.flash.autoFired'), value: 'Auto (fired)' },
  ])

  return {
    exposureProgramOptions,
    exposureModeOptions,
    meteringModeOptions,
    whiteBalanceOptions,
    flashOptions,
  }
}
