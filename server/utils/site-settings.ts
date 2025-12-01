import type { SiteSetting } from '../../app/generated/prisma/client'
import type { SiteInfoPlacement } from '~/types/gallery'
import type { SiteSettings, SiteSettingsPayload, SiteSocialLinks } from '~/types/site'
import { prisma } from './prisma'

const FALLBACK_NAME = 'Liora Gallery'
const FALLBACK_DESCRIPTION = 'A minimal gallery for photography and illustrations.'
const FALLBACK_ICON_URL = '/favicon.ico'
const FALLBACK_INFO_PLACEMENT: SiteInfoPlacement = 'header'

function normalizeText(value: string | undefined): string {
  return value?.trim() ?? ''
}

function normalizeIconUrl(value: string | undefined): string {
  const trimmed = normalizeText(value)
  return trimmed.length > 0 ? trimmed : FALLBACK_ICON_URL
}

function normalizeInfoPlacement(value: string | undefined): SiteInfoPlacement {
  return value === 'waterfall' ? 'waterfall' : FALLBACK_INFO_PLACEMENT
}

function validateIconUrl(value: string): string {
  const normalized = normalizeText(value)
  if (normalized.length === 0) {
    return FALLBACK_ICON_URL
  }

  const lowered = normalized.toLowerCase()
  if (lowered.startsWith('data:image')) {
    return normalized
  }

  try {
    const resolved = new URL(normalized, 'http://localhost')
    const protocol = resolved.protocol
    if (protocol === 'http:' || protocol === 'https:') {
      return normalized
    }
  }
  catch {
    // fall through to error
  }

  throw createError({ statusCode: 400, statusMessage: 'Icon URL must be an http(s) URL, a relative path, or a data:image URI.' })
}

function resolveDefaultSocial(): SiteSocialLinks {
  const runtimeConfig = useRuntimeConfig()
  const social = runtimeConfig.public.social
  return {
    homepage: normalizeText(social.homepage),
    github: normalizeText(social.github),
    twitter: normalizeText(social.twitter),
    instagram: normalizeText(social.instagram),
    weibo: normalizeText(social.weibo),
    youtube: normalizeText(social.youtube),
    bilibili: normalizeText(social.bilibili),
    tiktok: normalizeText(social.tiktok),
    linkedin: normalizeText(social.linkedin),
  }
}

function resolveDefaultSiteSetting(): {
  name: string
  description: string
  iconUrl: string
  social: SiteSocialLinks
  infoPlacement: SiteInfoPlacement
} {
  return {
    name: FALLBACK_NAME,
    description: FALLBACK_DESCRIPTION,
    iconUrl: FALLBACK_ICON_URL,
    social: resolveDefaultSocial(),
    infoPlacement: FALLBACK_INFO_PLACEMENT,
  }
}

function serialize(setting: SiteSetting): SiteSettings {
  return {
    name: setting.name,
    description: setting.description,
    iconUrl: normalizeIconUrl(setting.iconUrl),
    social: {
      homepage: setting.socialHomepage,
      github: setting.socialGithub,
      twitter: setting.socialTwitter,
      instagram: setting.socialInstagram,
      weibo: setting.socialWeibo,
      youtube: setting.socialYoutube,
      bilibili: setting.socialBilibili,
      tiktok: setting.socialTiktok,
      linkedin: setting.socialLinkedin,
    },
    infoPlacement: normalizeInfoPlacement(setting.infoPlacement),
    updatedAt: setting.updatedAt.toISOString(),
  }
}

function serializeDefaults(): SiteSettings {
  const defaults = resolveDefaultSiteSetting()
  return {
    ...defaults,
    updatedAt: new Date().toISOString(),
  }
}

export async function getSiteSettings(): Promise<SiteSettings> {
  const existing = await prisma.siteSetting.findUnique({ where: { id: 1 } })
  if (existing) {
    return serialize(existing)
  }

  return serializeDefaults()
}

function validateInfoPlacement(value: string | undefined): SiteInfoPlacement {
  const normalized = normalizeText(value).toLowerCase()
  if (normalized === 'waterfall') {
    return 'waterfall'
  }
  if (normalized === 'header' || normalized.length === 0) {
    return FALLBACK_INFO_PLACEMENT
  }
  throw createError({ statusCode: 400, statusMessage: 'Invalid info placement.' })
}

function validatePayload(payload: SiteSettingsPayload): SiteSettingsPayload {
  const trimmedName = normalizeText(payload.name)
  const trimmedDescription = normalizeText(payload.description)

  if (trimmedName.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Site name is required.' })
  }

  return {
    name: trimmedName,
    description: trimmedDescription,
    iconUrl: validateIconUrl(payload.iconUrl),
    infoPlacement: validateInfoPlacement(payload.infoPlacement),
    social: {
      homepage: normalizeText(payload.social.homepage),
      github: normalizeText(payload.social.github),
      twitter: normalizeText(payload.social.twitter),
      instagram: normalizeText(payload.social.instagram),
      weibo: normalizeText(payload.social.weibo),
      youtube: normalizeText(payload.social.youtube),
      bilibili: normalizeText(payload.social.bilibili),
      tiktok: normalizeText(payload.social.tiktok),
      linkedin: normalizeText(payload.social.linkedin),
    },
  }
}

export async function updateSiteSettings(payload: SiteSettingsPayload): Promise<SiteSettings> {
  const validated = validatePayload(payload)
  const updated = await prisma.siteSetting.upsert({
    where: { id: 1 },
    update: {
      name: validated.name,
      description: validated.description,
      iconUrl: validated.iconUrl,
      infoPlacement: validated.infoPlacement,
      socialHomepage: validated.social.homepage,
      socialGithub: validated.social.github,
      socialTwitter: validated.social.twitter,
      socialInstagram: validated.social.instagram,
      socialWeibo: validated.social.weibo,
      socialYoutube: validated.social.youtube,
      socialBilibili: validated.social.bilibili,
      socialTiktok: validated.social.tiktok,
      socialLinkedin: validated.social.linkedin,
    },
    create: {
      id: 1,
      name: validated.name,
      description: validated.description,
      iconUrl: validated.iconUrl,
      infoPlacement: validated.infoPlacement,
      socialHomepage: validated.social.homepage,
      socialGithub: validated.social.github,
      socialTwitter: validated.social.twitter,
      socialInstagram: validated.social.instagram,
      socialWeibo: validated.social.weibo,
      socialYoutube: validated.social.youtube,
      socialBilibili: validated.social.bilibili,
      socialTiktok: validated.social.tiktok,
      socialLinkedin: validated.social.linkedin,
    },
  })
  return serialize(updated)
}

export async function updateSiteIcon(iconUrl: string): Promise<SiteSettings> {
  const validatedIcon = validateIconUrl(iconUrl)
  const defaults = resolveDefaultSiteSetting()
  const updated = await prisma.siteSetting.upsert({
    where: { id: 1 },
    update: { iconUrl: validatedIcon },
    create: {
      id: 1,
      name: defaults.name,
      description: defaults.description,
      iconUrl: validatedIcon,
      infoPlacement: defaults.infoPlacement,
      socialHomepage: defaults.social.homepage,
      socialGithub: defaults.social.github,
      socialTwitter: defaults.social.twitter,
      socialInstagram: defaults.social.instagram,
      socialWeibo: defaults.social.weibo,
      socialYoutube: defaults.social.youtube,
      socialBilibili: defaults.social.bilibili,
      socialTiktok: defaults.social.tiktok,
      socialLinkedin: defaults.social.linkedin,
    },
  })
  return serialize(updated)
}
