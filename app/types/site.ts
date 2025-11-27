export interface SiteSocialLinks {
  github: string
  twitter: string
  instagram: string
  weibo: string
  youtube: string
  bilibili: string
  tiktok: string
  linkedin: string
}

export interface SiteSettingsPayload {
  name: string
  description: string
  iconUrl: string
  social: SiteSocialLinks
}

export interface SiteSettings extends SiteSettingsPayload {
  updatedAt: string
}
