import type { H3Event } from 'h3'
import { createError, getRouterParam } from 'h3'

export function requirePositiveInt(value: string | number | undefined, invalidMessage: string): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw createError({ statusCode: 400, statusMessage: invalidMessage })
  }
  return parsed
}

export function requirePositiveIntRouterParam(event: H3Event, key: string, invalidMessage: string): number {
  return requirePositiveInt(getRouterParam(event, key), invalidMessage)
}
