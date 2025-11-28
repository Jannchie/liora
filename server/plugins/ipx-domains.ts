import { defineNitroPlugin, useRuntimeConfig } from '#imports'

function resolveHost(value: string | undefined): string | null {
  if (!value) {
    return null
  }
  try {
    const parsed = new URL(value)
    return parsed.host || null
  }
  catch {
    return null
  }
}

export default defineNitroPlugin(() => {
  const config = useRuntimeConfig()
  const currentDomains = new Set<string>(config.ipx?.http?.domains ?? [])

  const storage = config.storage as { endpoint?: string, publicBaseUrl?: string } | undefined
  const candidates = [storage?.publicBaseUrl, storage?.endpoint]
  for (const candidate of candidates) {
    const host = resolveHost(candidate)
    if (host) {
      currentDomains.add(host)
    }
  }

  if (!config.ipx) {
    config.ipx = {}
  }
  const httpConfig = config.ipx.http ?? {}
  config.ipx.http = {
    ...httpConfig,
    domains: [...currentDomains],
  }
})
