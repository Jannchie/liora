import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { codec, encodeSync, init as initArthash } from 'arthash'

export const ARTHASH_CODEC = codec.rect({ n: 64 })

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
  return encodeSync(rgb, width, height, ARTHASH_CODEC)
}
