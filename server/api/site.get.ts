import type { SiteSettings } from '~/types/site'
import { getSiteSettings } from '../utils/site-settings'

export default defineEventHandler(async (): Promise<SiteSettings> => {
  return getSiteSettings()
})
