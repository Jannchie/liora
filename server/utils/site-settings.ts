import type { SiteSetting } from '../../app/generated/prisma/client'
import type { SiteSettings, SiteSettingsPayload, SiteSocialLinks } from '~/types/site'
import { prisma } from './prisma'

const FALLBACK_NAME = 'Liora Gallery'
const FALLBACK_DESCRIPTION = 'A minimal gallery for photography and illustrations.'
const FALLBACK_ICON_URL = '/favicon.ico'

function normalizeText(value: string | undefined): string {
  return value?.trim() ?? ''
}

function normalizeIconUrl(value: string | undefined): string {
  const trimmed = normalizeText(value)
  return trimmed.length > 0 ? trimmed : FALLBACK_ICON_URL
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
} {
  return {
    name: FALLBACK_NAME,
    description: FALLBACK_DESCRIPTION,
    iconUrl: FALLBACK_ICON_URL,
    social: resolveDefaultSocial(),
  }
}

function serialize(setting: SiteSetting): SiteSettings {
  return {
    name: setting.name,
    description: setting.description,
    iconUrl: normalizeIconUrl(setting.iconUrl),
    social: {
      github: setting.socialGithub,
      twitter: setting.socialTwitter,
      instagram: setting.socialInstagram,
      weibo: setting.socialWeibo,
      youtube: setting.socialYoutube,
      bilibili: setting.socialBilibili,
      tiktok: setting.socialTiktok,
      linkedin: setting.socialLinkedin,
    },
    updatedAt: setting.updatedAt.toISOString(),
  }
}

export async function getSiteSettings(): Promise<SiteSettings> {
  const existing = await prisma.siteSetting.findUnique({ where: { id: 1 } })
  if (existing) {
    return serialize(existing)
  }

  const defaults = resolveDefaultSiteSetting()
  const created = await prisma.siteSetting.create({
    data: {
      id: 1,
      name: defaults.name,
      description: defaults.description,
      iconUrl: defaults.iconUrl,
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
  return serialize(created)
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
    social: {
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
