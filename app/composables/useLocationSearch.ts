import type { GeocodeResult, MediaFormState } from '~/types/admin'
import { computed, ref } from 'vue'
import { useI18n, useToast } from '#imports'
import { readCoordinate } from '~/utils/exif-format'

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

  const getFormCoordinates = (): { latitude: number; longitude: number } | null => {
    const latitude = readCoordinate(form.latitude)
    const longitude = readCoordinate(form.longitude)
    if (latitude === null || longitude === null) {
      return null
    }
    return { latitude, longitude }
  }

  const applyGeocodeResult = (result: GeocodeResult): void => {
    const safeLat = readCoordinate(result.latitude)
    const safeLon = readCoordinate(result.longitude)
    const hasLatitude = readCoordinate(form.latitude) !== null
    const hasLongitude = readCoordinate(form.longitude) !== null
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
      const response =
        useReverseGeocode && coordinates
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
    } catch (error) {
      const description = error instanceof Error ? error.message : toastMessages.value.geocodeFailedFallback
      toast.add({ title: toastMessages.value.geocodeFailedTitle, description, color: 'error' })
    } finally {
      geocoding.value = false
    }
  }

  /**
   * Names the place at the form's coordinates, whatever names it already
   * has: after picking a point on the map the old names describe somewhere
   * else.
   */
  const reverseGeocode = async (): Promise<void> => {
    const coordinates = getFormCoordinates()
    if (!coordinates) {
      return
    }
    geocoding.value = true
    geocodeResults.value = []
    try {
      const response = await $fetch<{ results?: GeocodeResult[] }>('/api/geocode/reverse', {
        params: { lat: coordinates.latitude, lon: coordinates.longitude },
      })
      const [firstResult] = response.results ?? []
      if (firstResult) {
        applyGeocodeResult(firstResult)
      } else {
        toast.add({ title: toastMessages.value.geocodeNoResult, color: 'warning' })
      }
    } catch (error) {
      const description = error instanceof Error ? error.message : toastMessages.value.geocodeFailedFallback
      toast.add({ title: toastMessages.value.geocodeFailedTitle, description, color: 'error' })
    } finally {
      geocoding.value = false
    }
  }

  return {
    geocodeQuery,
    geocodeResults,
    geocoding,
    searchLocation,
    reverseGeocode,
    applyGeocodeResult,
  }
}
