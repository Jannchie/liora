import type { ComputedRef, Ref } from 'vue'
import { computed } from 'vue'
import type { SiteSettings } from '~/types/site'

const FALLBACK_ICON_URL = '/favicon.ico'

interface SiteSettingsState {
  settings: Ref<SiteSettings | null>
  loading: Ref<boolean>
  loaded: Ref<boolean>
  error: Ref<Error | null>
  iconUrl: ComputedRef<string>
  load: (force?: boolean) => Promise<SiteSettings | null>
  setSettings: (value: SiteSettings | null) => void
}

export function useSiteSettingsState(): SiteSettingsState {
  const settings = useState<SiteSettings | null>('site-settings', () => null)
  const loading = useState<boolean>('site-settings-loading', () => false)
  const loaded = useState<boolean>('site-settings-loaded', () => false)
  const error = useState<Error | null>('site-settings-error', () => null)

  const iconUrl = computed<string>(() => {
    const href = settings.value?.iconUrl?.trim()
    return href && href.length > 0 ? href : FALLBACK_ICON_URL
  })

  const load = async (force = false): Promise<SiteSettings | null> => {
    if (loading.value) {
      return settings.value
    }
    const hasResolvedData = settings.value !== null && error.value === null
    if (loaded.value && !force && hasResolvedData) {
      return settings.value
    }
    loading.value = true
    try {
      const fetched = await $fetch<SiteSettings>('/api/site')
      settings.value = fetched
      error.value = null
      loaded.value = true
      return fetched
    }
    catch (fetchError) {
      const fallbackError = fetchError instanceof Error ? fetchError : new Error('Failed to load site settings.')
      error.value = fallbackError
      settings.value = null
      loaded.value = true
      return null
    }
    finally {
      loading.value = false
    }
  }

  const setSettings = (value: SiteSettings | null): void => {
    settings.value = value
    if (value) {
      loaded.value = true
      error.value = null
    }
  }

  return { settings, loading, loaded, error, iconUrl, load, setSettings }
}
