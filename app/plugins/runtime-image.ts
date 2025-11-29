import { defineNuxtPlugin, useImage, useRuntimeConfig } from '#imports'

type DomainSource = string | string[] | undefined

function toHost(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }
  try {
    const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    return new URL(normalized).host
  }
  catch {
    return null
  }
}

function parseDomains(...sources: DomainSource[]): string[] {
  const entries: string[] = []

  for (const source of sources) {
    if (Array.isArray(source)) {
      entries.push(...source)
      continue
    }
    if (typeof source === 'string') {
      entries.push(...source.split(','))
    }
  }

  const hosts = new Set<string>()
  for (const entry of entries) {
    const host = toHost(entry)
    if (host) {
      hosts.add(host)
    }
  }
  return [...hosts]
}

export default defineNuxtPlugin(() => {
  const runtimeConfig = useRuntimeConfig()
  const image = useImage()
  const httpConfig = (runtimeConfig as { ipx?: { http?: { domains?: string[] } } }).ipx?.http

  const envDomains = process.env.NUXT_IMAGE_DOMAINS ?? process.env.NUXT_IPX_HTTP_DOMAINS
  const mergedDomains = parseDomains(
    image.options.domains,
    runtimeConfig.public.imageDomains as DomainSource,
    envDomains,
  )

  if (mergedDomains.length === 0) {
    return
  }

  image.options.domains = mergedDomains
  if (httpConfig) {
    httpConfig.domains = mergedDomains
  }
})
