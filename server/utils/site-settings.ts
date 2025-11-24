import type { SiteSetting } from '../../app/generated/prisma/client'
import type { SiteSettings, SiteSettingsPayload, SiteSocialLinks } from '~/types/site'
import { prisma } from './prisma'

const FALLBACK_NAME = 'Liora Gallery'
const FALLBACK_DESCRIPTION = 'A minimal gallery for photography and illustrations.'

const normalizeText = (value: string | undefined): string => value?.trim() ?? ''

function resolveDefaultSocial(): SiteSocialLinks {
  const runtimeConfig = useRuntimeConfig()
  const social = runtimeConfig.public.social
  return {
    github: normalizeText(social.github),
    twitter: normalizeText(social.twitter),
    instagram: normalizeText(social.instagram),
    weibo: normalizeText(social.weibo),
  }
}

function resolveDefaultSiteSetting(): {
  name: string
  description: string
  social: SiteSocialLinks
} {
  return {
    name: FALLBACK_NAME,
    description: FALLBACK_DESCRIPTION,
    social: resolveDefaultSocial(),
  }
}

function serialize(setting: SiteSetting): SiteSettings {
  return {
    name: setting.name,
    description: setting.description,
    social: {
      github: setting.socialGithub,
      twitter: setting.socialTwitter,
      instagram: setting.socialInstagram,
      weibo: setting.socialWeibo,
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
      socialGithub: defaults.social.github,
      socialTwitter: defaults.social.twitter,
      socialInstagram: defaults.social.instagram,
      socialWeibo: defaults.social.weibo,
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
    social: {
      github: normalizeText(payload.social.github),
      twitter: normalizeText(payload.social.twitter),
      instagram: normalizeText(payload.social.instagram),
      weibo: normalizeText(payload.social.weibo),
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
      socialGithub: validated.social.github,
      socialTwitter: validated.social.twitter,
      socialInstagram: validated.social.instagram,
      socialWeibo: validated.social.weibo,
    },
    create: {
      id: 1,
      name: validated.name,
      description: validated.description,
      socialGithub: validated.social.github,
      socialTwitter: validated.social.twitter,
      socialInstagram: validated.social.instagram,
      socialWeibo: validated.social.weibo,
    },
  })
  return serialize(updated)
}
