import { createError } from 'h3'

// Shared coercion helpers for file metadata fields. Previously these parsers
// were duplicated across the single-file update, batch-metadata and series
// endpoints with slightly different names. Two policies are provided:
//   - `optional*` keeps the caller's fallback when the value is `undefined`
//     (used by partial PUT updates).
//   - `require*` always coerces a present value (used once a field mask has
//     already decided the field is being changed).
// All validation failures surface as HTTP 400 errors.

function badRequest(field: string, expectation: string): never {
  const text = `${field} must be ${expectation}.`
  // Set both `message` and `statusMessage`: the former is read by callers that
  // collect per-item failures (batch endpoints), the latter is what HTTP clients
  // receive.
  throw createError({ statusCode: 400, message: text, statusMessage: text })
}

export function normalizeOptionalText(value: string | undefined, fallback: string): string {
  if (value === undefined) {
    return fallback
  }
  return value.trim()
}

export function requireTrimmedString(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    badRequest(field, 'a string')
  }
  return value.trim()
}

export function parseOptionalPositiveNumber(
  value: number | string | undefined,
  fallback: number,
  field: string,
): number {
  if (value === undefined) {
    return fallback
  }
  return requirePositiveNumber(value, field)
}

export function requirePositiveNumber(value: unknown, field: string): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    badRequest(field, 'a positive number')
  }
  return parsed
}

export function parseOptionalNullableNumber(
  value: number | string | null | undefined,
  fallback: number | null,
  field: string,
): number | null {
  if (value === undefined) {
    return fallback
  }
  return requireNullableNumber(value, field)
}

export function requireNullableNumber(value: unknown, field: string): number | null {
  if (value === null) {
    return null
  }
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) {
    badRequest(field, 'a valid number')
  }
  return parsed
}

export function normalizeOptionalCharacters(
  value: string | string[] | undefined,
  fallback: string[],
): string[] {
  if (value === undefined) {
    return fallback
  }
  const list = Array.isArray(value) ? value : value.split(/[,，\n]/)
  return list
    .map(item => item.trim())
    .filter(item => item.length > 0)
}
