import { codec, init, toSvgSync } from 'arthash'
import wasmUrl from 'arthash/wasm/pkg/arthash_wasm_bg.wasm?url'
import { ref } from 'vue'

const ARTHASH_CODEC = codec.rect({ n: 64 })
const SVG_OPTIONS = { baseSize: 256 } as const

export const arthashReady = ref(false)
let initPromise: Promise<void> | null = null

export function ensureArthashReady(): Promise<void> {
  if (!initPromise) {
    initPromise = init(wasmUrl)
      .then(() => {
        arthashReady.value = true
      })
      .catch((error) => {
        console.warn('Failed to initialize arthash:', error)
      })
  }
  return initPromise
}

function base64ToBytes(value: string): Uint8Array {
  if (typeof atob === 'function') {
    const binary = atob(value)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.codePointAt(index) || 0
    }
    return bytes
  }
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(value, 'base64'))
  }
  throw new Error('No base64 decoder available.')
}

export function decodeArthashToDataUrl(value: string | undefined): string | null {
  if (!value || !arthashReady.value) {
    return null
  }
  try {
    const bytes = base64ToBytes(value)
    const svg = toSvgSync(bytes, ARTHASH_CODEC, SVG_OPTIONS)
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  }
  catch (error) {
    console.warn('Failed to decode arthash:', error)
    return null
  }
}

export interface ArthashSvgAnimOptions {
  fadeDurationMs?: number
  staggerMs?: number
}

export interface ArthashSvgResult {
  svg: string
  totalDurationMs: number
}

// Stable pseudo-random permutation of 0..n-1. Same input → same order, so the
// animation feels lively without being SSR/CSR mismatched between renders of
// the same tile.
function permutation(n: number): number[] {
  const order = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i -= 1) {
    // Deterministic mulberry-ish step keyed only on i.
    const j = (i * 2_654_435_761) % (i + 1)
    const tmp = order[i]!
    order[i] = order[j]!
    order[j] = tmp
  }
  return order
}

export function decodeArthashToAnimatedSvg(
  value: string | undefined,
  options: ArthashSvgAnimOptions = {},
): ArthashSvgResult | null {
  if (!value || !arthashReady.value) {
    return null
  }
  const fadeDuration = options.fadeDurationMs ?? 140
  const stagger = options.staggerMs ?? 14
  try {
    const bytes = base64ToBytes(value)
    const raw = toSvgSync(bytes, ARTHASH_CODEC, SVG_OPTIONS)
    // Count rects to size the permutation array. The SVG also has one
    // <path/> background which we fade first (no delay).
    const rectCount = (raw.match(/<rect\b/g) ?? []).length
    const order = permutation(rectCount)
    let rectIdx = 0
    let svg = raw.replace(
      /<path\b/,
      `<path style="transition:opacity ${fadeDuration}ms ease-out;transition-delay:0ms"`,
    )
    svg = svg.replaceAll(/<rect\b/g, () => {
      const delay = stagger + order[rectIdx]! * stagger
      rectIdx += 1
      return `<rect style="transition:opacity ${fadeDuration}ms ease-out;transition-delay:${delay}ms"`
    })
    // Make the root SVG fill its container.
    svg = svg.replace(
      /<svg\b([^>]*)>/,
      '<svg$1 preserveAspectRatio="none" style="display:block;width:100%;height:100%">',
    )
    const totalDurationMs = fadeDuration + stagger * (rectCount + 1)
    return { svg, totalDurationMs }
  }
  catch (error) {
    console.warn('Failed to decode arthash:', error)
    return null
  }
}
