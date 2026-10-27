/**
 * Vendor the subset of Jannchie Icons the app references.
 *
 * Scans `app/` for `jannchie:<name>` strings, pulls the matching icons out of
 * the published `@jannchie/iconify-json` collection and writes them to
 * `app/assets/icons/jannchie.json`, which nuxt.config registers as a custom
 * @nuxt/icon collection. Vendoring keeps the full 2,700-icon package out of
 * the dependency tree; rerun after using a new icon name.
 *
 * Usage: pnpm icons:generate [path/to/icons.json]
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import process from 'node:process'

const VERSION = '0.10.0'
const SOURCE_URL = `https://cdn.jsdelivr.net/npm/@jannchie/iconify-json@${VERSION}/icons.json`
const ROOT = join(import.meta.dirname, '..')
const OUTPUT = join(ROOT, 'app/assets/icons/jannchie.json')

interface IconifyIcon {
  body: string
  width?: number
  height?: number
}
interface IconifyJSON {
  prefix: string
  icons: Record<string, IconifyIcon>
  aliases?: Record<string, { parent: string }>
  width?: number
  height?: number
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const path = join(dir, entry)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

function collectNames(): Set<string> {
  const names = new Set<string>()
  for (const file of walk(join(ROOT, 'app'))) {
    if (!/\.(?:vue|ts)$/.test(file)) {
      continue
    }
    for (const match of readFileSync(file, 'utf8').matchAll(/jannchie:([a-z0-9-]+)/g)) {
      names.add(match[1]!)
    }
  }
  return names
}

async function loadSource(): Promise<IconifyJSON> {
  const local = process.argv[2]
  if (local) {
    return JSON.parse(readFileSync(local, 'utf8')) as IconifyJSON
  }
  const response = await fetch(SOURCE_URL)
  if (!response.ok) {
    throw new Error(`Failed to fetch ${SOURCE_URL}: ${response.status}`)
  }
  return (await response.json()) as IconifyJSON
}

const source = await loadSource()
const icons: Record<string, IconifyIcon> = {}
const missing: string[] = []
for (const name of [...collectNames()].toSorted()) {
  const resolved = source.icons[name] ?? source.icons[source.aliases?.[name]?.parent ?? '']
  if (resolved) {
    icons[name] = resolved
  } else {
    missing.push(name)
  }
}

if (missing.length > 0) {
  throw new Error(`Unknown Jannchie icons: ${missing.join(', ')}`)
}

const output: IconifyJSON = { prefix: 'jannchie', width: source.width ?? 24, height: source.height ?? 24, icons }
writeFileSync(OUTPUT, `${JSON.stringify(output, null, 2)}\n`)
console.log(`Wrote ${Object.keys(icons).length} icons to ${relative(ROOT, OUTPUT)}`)
