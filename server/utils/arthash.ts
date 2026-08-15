import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { codec, encodeSync, init as initArthash } from 'arthash'

export const ARTHASH_CODEC = codec.rect({ n: 64 })

const require = createRequire(import.meta.url)
const currentDir = fileURLToPath(new URL('.', import.meta.url))

function resolveArthashWasmPath(): string {
  let resolvedByRequire: string | undefined
  try {
    // Normal Node module resolution (source tree, dev, and Nitro's traced
    // server node_modules when the file is included in the server bundle).
    resolvedByRequire = require.resolve('arthash/wasm/pkg/arthash_wasm_bg.wasm')
  }
  catch {
    resolvedByRequire = undefined
  }
  const candidates = [
    ...(resolvedByRequire ? [resolvedByRequire] : []),
    // Source tree fallback when running from a checkout without symlinks.
    resolve(currentDir, '../../node_modules/arthash/wasm/pkg/arthash_wasm_bg.wasm'),
    // Bundled Nitro output (index/chunks can live under .output/server).
    resolve(currentDir, 'node_modules/arthash/wasm/pkg/arthash_wasm_bg.wasm'),
    resolve(currentDir, '../node_modules/arthash/wasm/pkg/arthash_wasm_bg.wasm'),
    resolve(process.cwd(), 'node_modules/arthash/wasm/pkg/arthash_wasm_bg.wasm'),
    resolve(process.cwd(), '.output/server/node_modules/arthash/wasm/pkg/arthash_wasm_bg.wasm'),
  ]

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate
    }
  }

  throw new Error(
    `Unable to locate arthash WASM file. Tried:\n${candidates.map(path => `- ${path}`).join('\n')}`,
  )
}

let initPromise: Promise<void> | null = null

async function loadArthash(): Promise<void> {
  const wasmPath = resolveArthashWasmPath()
  const wasmBytes = await readFile(wasmPath)
  await initArthash(wasmBytes)
}

export async function ensureArthashReady(): Promise<void> {
  if (!initPromise) {
    initPromise = loadArthash()
  }
  try {
    await initPromise
  }
  catch (error) {
    // Allow future calls to retry after a transient failure (e.g. a missing
    // WASM file during a rolling deploy) instead of being stuck forever.
    initPromise = null
    throw error
  }
}

export async function encodeArthashFromRgb(rgb: Uint8Array, width: number, height: number): Promise<Uint8Array> {
  await ensureArthashReady()
  return encodeSync(rgb, width, height, ARTHASH_CODEC)
}
