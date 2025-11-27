import type { H3Event } from 'h3'
import type { SiteSettings, SiteSettingsPayload } from '~/types/site'
import { requireAdmin } from '../utils/auth'
import { updateSiteSettings } from '../utils/site-settings'

function normalizePayload(body: Partial<SiteSettingsPayload>): SiteSettingsPayload {
  return {
    name: typeof body.name === 'string' ? body.name : '',
    description: typeof body.description === 'string' ? body.description : '',
    iconUrl: typeof body.iconUrl === 'string' ? body.iconUrl : '',
    social: {
      github: typeof body.social?.github === 'string' ? body.social.github : '',
      twitter: typeof body.social?.twitter === 'string' ? body.social.twitter : '',
      instagram: typeof body.social?.instagram === 'string' ? body.social.instagram : '',
      weibo: typeof body.social?.weibo === 'string' ? body.social.weibo : '',
      youtube: typeof body.social?.youtube === 'string' ? body.social.youtube : '',
      bilibili: typeof body.social?.bilibili === 'string' ? body.social.bilibili : '',
      tiktok: typeof body.social?.tiktok === 'string' ? body.social.tiktok : '',
      linkedin: typeof body.social?.linkedin === 'string' ? body.social.linkedin : '',
    },
  }
}

export default defineEventHandler(async (event: H3Event): Promise<SiteSettings> => {
  await requireAdmin(event)
  const body = await readBody<Partial<SiteSettingsPayload>>(event)
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Invalid payload.' })
  }
  const payload = normalizePayload(body)
  return updateSiteSettings(payload)
})
