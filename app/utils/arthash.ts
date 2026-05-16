import { init, Shape, toSvg } from 'arthash'
import wasmUrl from 'arthash/wasm/pkg/arthash_wasm_bg.wasm?url'
import { ref } from 'vue'

const ARTHASH_OPTIONS = { shape: Shape.RECT, nShapes: 64, baseSize: 256 } as const

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
    const svg = toSvg(bytes, { ...ARTHASH_OPTIONS, blur: 12 })
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  }
  catch (error) {
    console.warn('Failed to decode arthash:', error)
    return null
  }
}
