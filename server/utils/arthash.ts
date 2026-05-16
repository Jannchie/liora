import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { encode as encodeArthash, init as initArthash, Shape } from 'arthash'

export const ARTHASH_OPTIONS = { shape: Shape.RECT, nShapes: 64 } as const

const require = createRequire(import.meta.url)

let initPromise: Promise<void> | null = null

export function ensureArthashReady(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const wasmPath = require.resolve('arthash/wasm/pkg/arthash_wasm_bg.wasm')
      const wasmBytes = await readFile(wasmPath)
      await initArthash(wasmBytes)
    })()
  }
  return initPromise
}

export async function encodeArthashFromRgb(rgb: Uint8Array, width: number, height: number): Promise<Uint8Array> {
  await ensureArthashReady()
  return encodeArthash(rgb, width, height, ARTHASH_OPTIONS)
}
