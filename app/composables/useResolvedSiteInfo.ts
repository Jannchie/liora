import type { ComputedRef, MaybeRef } from 'vue'
import type { SocialLink } from '~/types/gallery'
import type { SiteSettings } from '~/types/site'
import { computed, unref } from 'vue'

interface ResolvedSiteInfo {
  siteName: ComputedRef<string>
  siteDescription: ComputedRef<string>
  socialLinks: ComputedRef<SocialLink[]>
}

export function useResolvedSiteInfo(settings: MaybeRef<SiteSettings | null | undefined>): ResolvedSiteInfo {
  const { t } = useI18n()
  const runtimeConfig = useRuntimeConfig()
  const siteConfig = useSiteConfig()

  const resolvedSettings = computed(() => unref(settings) ?? null)
  const resolvedSiteConfig = computed(() => unref(siteConfig))

  const siteName = computed(() => {
    const customized = resolvedSettings.value?.name?.trim()
    if (customized && customized.length > 0) {
      return customized
    }
    const configured = resolvedSiteConfig.value.name?.trim()
    if (configured && configured.length > 0) {
      return configured
    }
    return t('home.defaultTitle')
  })

  const siteDescription = computed(() => {
    const customized = resolvedSettings.value?.description?.trim()
    if (customized && customized.length > 0) {
      return customized
    }
    const fallback = resolvedSiteConfig.value.description ?? ''
    if (fallback && fallback.length > 0) {
      return fallback
    }
    return t('home.defaultDescription')
  })

  const socialLinks = computed<SocialLink[]>(() => {
    const links: SocialLink[] = []
    const social = resolvedSettings.value?.social ?? runtimeConfig.public.social

    const appendLink = (label: string, url: string | undefined, icon: string): void => {
      const trimmed = (url ?? '').trim()
      if (trimmed.length > 0) {
        links.push({ label, url: trimmed, icon })
      }
    }

    appendLink('Homepage', social.homepage, 'mdi:home')
    appendLink('GitHub', social.github, 'mdi:github')
    appendLink('X', social.twitter, 'fa6-brands:x-twitter')
    appendLink('Instagram', social.instagram, 'mdi:instagram')
    appendLink('YouTube', social.youtube, 'mdi:youtube')
    appendLink('TikTok', social.tiktok, 'fa6-brands:tiktok')
    appendLink('Bilibili', social.bilibili, 'simple-icons:bilibili')
    appendLink('LinkedIn', social.linkedin, 'mdi:linkedin')
    appendLink('Weibo', social.weibo, 'mdi:sina-weibo')
    return links
  })

  return { siteName, siteDescription, socialLinks }
}
