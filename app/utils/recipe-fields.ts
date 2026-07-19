import type { RecipeAdjustmentItem, RecipeCurvePoint } from '~/types/gallery'

// Shared primitives for parsing an editor's XMP recipe payload into the
// panel's view model. Both the Lightroom (`crs:*`) and LLR (`llr:*`) parsers
// build on these, so field-level guarding stays in one place: malformed input
// yields `null`/`undefined` rather than throwing.

export function toDisplayText(value: string | null | undefined): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

export function isNearlyEqual(value: number, target: number, epsilon: number = 1e-4): boolean {
  return Math.abs(value - target) <= epsilon
}

export function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  return value as Record<string, unknown>
}

export function parseRecipeNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export function parseRecipeText(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export function parseCurvePoints(source: unknown): RecipeCurvePoint[] {
  if (!Array.isArray(source)) {
    return []
  }
  const points: RecipeCurvePoint[] = []
  for (const element of source) {
    if (Array.isArray(element) && element.length >= 2) {
      const x = parseRecipeNumber(element[0])
      const y = parseRecipeNumber(element[1])
      if (x !== null && y !== null) {
        points.push({ x, y })
      }
      continue
    }
    const object = asObject(element)
    if (object) {
      const x = parseRecipeNumber(object.x)
      const y = parseRecipeNumber(object.y)
      if (x !== null && y !== null) {
        points.push({ x, y })
      }
    }
  }
  return points.length >= 2 ? points : []
}

export function createRecipeItem(params: {
  key: string
  label: string
  source: unknown
  min: number
  max: number
  digits?: number
  defaultValue?: number
  zeroCentered?: boolean
  unit?: string
}): RecipeAdjustmentItem | null {
  const value = parseRecipeNumber(params.source)
  if (value === null) {
    return null
  }
  if (isNearlyEqual(value, params.defaultValue ?? 0)) {
    return null
  }
  return {
    key: params.key,
    label: params.label,
    value,
    min: params.min,
    max: params.max,
    digits: params.digits,
    zeroCentered: params.zeroCentered,
    unit: params.unit,
  }
}
