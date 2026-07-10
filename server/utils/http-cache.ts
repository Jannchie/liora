import type { H3Event } from 'h3'
import { createHash } from 'node:crypto'
import { handleCacheHeaders } from 'h3'

/**
 * Content-based ETag for JSON endpoints: clients revalidate on every request
 * (same freshness as the previous no-store headers) but get a 304 instead of
 * a full payload when nothing changed.
 *
 * Returns true when the request's If-None-Match matched and a 304 has been
 * prepared — the handler should return null without a body in that case.
 */
export function handleJsonEtag(event: H3Event, payload: unknown): boolean {
  const etag = `"${createHash('sha1').update(JSON.stringify(payload)).digest('base64url')}"`
  // h3 prepends 'public' to cacheControls on its own.
  return handleCacheHeaders(event, {
    etag,
    cacheControls: ['no-cache'],
  })
}
