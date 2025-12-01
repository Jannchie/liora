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
  }))

  const resolveGeocodeQuery = (): string => {
    const candidates = [geocodeQuery.value, form.locationName, form.location].map(value => value.trim())
    const found = candidates.find(value => value.length > 0)
    return found ?? ''
  }

  const getFormCoordinates = (): { latitude: number, longitude: number } | null => {
    const latitude = Number.isFinite(form.latitude) ? Number(form.latitude) : null
    const longitude = Number.isFinite(form.longitude) ? Number(form.longitude) : null
    if (latitude === null || longitude === null) {
      return null
    }
    return { latitude, longitude }
  }

  const applyGeocodeResult = (result: GeocodeResult): void => {
    const safeLat = Number.isFinite(result.latitude) ? Number.parseFloat(result.latitude.toFixed(6)) : null
    const safeLon = Number.isFinite(result.longitude) ? Number.parseFloat(result.longitude.toFixed(6)) : null
    const hasLatitude = form.latitude !== null && form.latitude !== undefined && !Number.isNaN(form.latitude)
    const hasLongitude = form.longitude !== null && form.longitude !== undefined && !Number.isNaN(form.longitude)
    if (safeLat !== null && !hasLatitude) {
      form.latitude = safeLat
    }
    if (safeLon !== null && !hasLongitude) {
      form.longitude = safeLon
    }
    form.locationName = result.placeName
    if (result.name) {
      form.location = result.name
    }
    geocodeQuery.value = result.name
  }

  const searchLocation = async (): Promise<void> => {
    const query = resolveGeocodeQuery()
    const coordinates = getFormCoordinates()
    const useReverseGeocode = !query && coordinates !== null
    if (!query && !useReverseGeocode) {
      toast.add({ title: toastMessages.value.geocodeMissingQuery, color: 'warning' })
      return
    }

    geocoding.value = true
    geocodeResults.value = []
    try {
      const response = useReverseGeocode && coordinates
        ? await $fetch<{ results?: GeocodeResult[] }>('/api/geocode/reverse', {
            params: {
              lat: coordinates.latitude,
              lon: coordinates.longitude,
            },
          })
        : await $fetch<{ results?: GeocodeResult[] }>('/api/geocode', {
            params: { q: query, limit: 5 },
          })
      geocodeResults.value = response.results ?? []
      if (geocodeResults.value.length === 0) {
        toast.add({ title: toastMessages.value.geocodeNoResult, color: 'warning' })
      }
      if (useReverseGeocode) {
        const [firstResult] = geocodeResults.value
        if (firstResult) {
          applyGeocodeResult(firstResult)
        }
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
