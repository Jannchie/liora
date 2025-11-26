import type { GeocodeResult, MediaFormState } from '~/types/admin'
import { computed, ref } from 'vue'

export function useLocationSearch(form: MediaFormState) {
  const { t } = useI18n()
  const toast = useToast()

  const geocodeQuery = ref('')
  const geocodeResults = ref<GeocodeResult[]>([])
  const geocoding = ref(false)

  const toastMessages = computed(() => ({
    geocodeMissingQuery: t('admin.upload.toast.geocodeMissingQuery'),
    geocodeFailedTitle: t('admin.upload.toast.geocodeFailedTitle'),
    geocodeFailedFallback: t('admin.upload.toast.geocodeFailedFallback'),
    geocodeNoResult: t('admin.upload.toast.geocodeNoResult'),
    geocodeAppliedTitle: t('admin.upload.toast.geocodeAppliedTitle'),
  }))

  const resolveGeocodeQuery = (): string => {
    const candidates = [geocodeQuery.value, form.locationName, form.location].map(value => value.trim())
    const found = candidates.find(value => value.length > 0)
    return found ?? ''
  }

  const applyGeocodeResult = (result: GeocodeResult): void => {
    const safeLat = Number.isFinite(result.latitude) ? Number.parseFloat(result.latitude.toFixed(6)) : null
    const safeLon = Number.isFinite(result.longitude) ? Number.parseFloat(result.longitude.toFixed(6)) : null
    if (safeLat !== null) {
      form.latitude = safeLat
    }
    if (safeLon !== null) {
      form.longitude = safeLon
    }
    form.locationName = result.placeName
    if (!form.location) {
      form.location = result.placeName
    }
    geocodeQuery.value = result.name
    toast.add({ title: toastMessages.value.geocodeAppliedTitle, description: result.placeName, color: 'primary' })
  }

  const searchLocation = async (): Promise<void> => {
    const query = resolveGeocodeQuery()
    if (!query) {
      toast.add({ title: toastMessages.value.geocodeMissingQuery, color: 'warning' })
      return
    }

    geocoding.value = true
    geocodeResults.value = []
    try {
      const response = await $fetch<{ results?: GeocodeResult[] }>('/api/geocode', {
        params: { q: query, limit: 5 },
      })
      geocodeResults.value = response.results ?? []
      if (geocodeResults.value.length === 0) {
        toast.add({ title: toastMessages.value.geocodeNoResult, color: 'warning' })
      }
    }
    catch (error) {
      const description = error instanceof Error ? error.message : toastMessages.value.geocodeFailedFallback
      toast.add({ title: toastMessages.value.geocodeFailedTitle, description, color: 'error' })
    }
    finally {
      geocoding.value = false
    }
  }

  return {
    geocodeQuery,
    geocodeResults,
    geocoding,
    searchLocation,
    applyGeocodeResult,
  }
}
