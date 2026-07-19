/**
 * Maps an EXIF camera string onto a brand logo plus the bare model name.
 * Shared by the gallery metadata panel and the OG card so a shot is labelled
 * the same way in-app and on a share preview.
 */
import type { BrandIconKey } from '~/constants/brand-icons'
import { toDisplayText } from './recipe-fields'

interface CameraBrandRule {
  /** Omitted for brands simple-icons has dropped — they fall back to `label`. */
  icon?: BrandIconKey
  keywords: string[]
  label: string
  patterns?: RegExp[]
}

export function escapeRegExp(value: string): string {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\\$&`)
}

export const cameraBrandRules: CameraBrandRule[] = [
  { keywords: ['canon', 'eos'], label: 'Canon' },
  { icon: 'nikon', keywords: ['nikon'], label: 'Nikon' },
  { icon: 'sony', keywords: ['sony', 'ilce', 'alpha'], label: 'Sony' },
  { icon: 'fujifilm', keywords: ['fujifilm', 'fuji'], label: 'Fujifilm' },
  { icon: 'panasonic', keywords: ['panasonic', 'lumix'], label: 'Panasonic' },
  { keywords: ['olympus', 'om system', 'om-system', 'omd'], label: 'Olympus' },
  { icon: 'leica', keywords: ['leica'], label: 'Leica' },
  { keywords: ['pentax'], label: 'Pentax' },
  {
    keywords: ['ricoh'],
    label: 'Ricoh',
    patterns: [/\bgr\s?(digital\s*)?(i{1,3}|\d)\b/],
  },
  { keywords: ['sigma'], label: 'Sigma' },
  { keywords: ['hasselblad'], label: 'Hasselblad' },
  { icon: 'dji', keywords: ['dji'], label: 'DJI' },
  { keywords: ['gopro', 'hero'], label: 'GoPro' },
  { icon: 'apple', keywords: ['apple', 'iphone', 'ipad', 'ipod'], label: 'Apple' },
  {
    icon: 'samsung',
    keywords: ['samsung'],
    label: 'Samsung',
    patterns: [/\bsm\s?[a-z0-9]{3,}/],
  },
  { icon: 'huawei', keywords: ['huawei'], label: 'Huawei' },
  {
    icon: 'xiaomi',
    keywords: ['xiaomi', 'redmi', 'mi '],
    label: 'Xiaomi',
    patterns: [/\bmi\s?\d{1,2}\b/],
  },
  {
    icon: 'oppo',
    keywords: ['oppo'],
    label: 'Oppo',
    patterns: [/\bcph\d{3,}/],
  },
  { icon: 'vivo', keywords: ['vivo', 'iqoo'], label: 'Vivo' },
  { icon: 'oneplus', keywords: ['oneplus'], label: 'OnePlus' },
  { icon: 'google', keywords: ['pixel', 'google'], label: 'Google' },
  {
    icon: 'motorola',
    keywords: ['motorola', 'moto'],
    label: 'Motorola',
    patterns: [/\bxt\d{3,}/],
  },
  { icon: 'nokia', keywords: ['nokia'], label: 'Nokia' },
  { icon: 'honor', keywords: ['honor'], label: 'Honor' },
  { icon: 'meizu', keywords: ['meizu'], label: 'Meizu' },
  { icon: 'lenovo', keywords: ['lenovo'], label: 'Lenovo' },
  { icon: 'asus', keywords: ['asus', 'zenfone', 'rog phone', 'rog'], label: 'Asus' },
  { icon: 'sharp', keywords: ['sharp', 'aquos'], label: 'Sharp' },
  {
    icon: 'lg',
    keywords: ['lg '],
    label: 'LG',
    patterns: [/\blg\s?[a-z0-9]{2,}/],
  },
]

/* Compiled once per rule: the table is module-static, so rebuilding these on
   every lookup would be pure setup cost. */
const brandPrefixPatterns = new Map<CameraBrandRule, RegExp[]>(
  cameraBrandRules.map(rule => [
    rule,
    [...rule.keywords, rule.label]
      .filter(prefix => prefix.trim().length > 0)
      .map(prefix => new RegExp(String.raw`^\s*${escapeRegExp(prefix)}[\s·|/,:-]*`, 'i')),
  ]),
)

function normalizeCameraText(value: string): string {
  return value.toLowerCase().replaceAll(/[-_/]+/g, ' ').replaceAll(/\s+/g, ' ').trim()
}

function matchesCameraBrand(value: string, rule: CameraBrandRule): boolean {
  if (rule.keywords.some(keyword => value.includes(keyword))) {
    return true
  }
  return (rule.patterns ?? []).some(pattern => pattern.test(value))
}

/** Drops the first brand prefix that matches; returns the input when none does. */
function stripBrandPrefix(cameraText: string, rule: CameraBrandRule): string {
  for (const pattern of brandPrefixPatterns.get(rule) ?? []) {
    const next = cameraText.replace(pattern, '').trim()
    if (next.length > 0 && next !== cameraText) {
      return next
    }
  }
  return cameraText
}

/** Repeats until stable, so "SONY ILCE-7CM2" reduces all the way to "7CM2". */
function stripBrandPrefixes(cameraText: string, rule: CameraBrandRule): string {
  let output = cameraText
  for (let next = stripBrandPrefix(output, rule); next !== output; next = stripBrandPrefix(output, rule)) {
    output = next
  }
  return output
}

export function resolveCameraBrand(
  camera: string | undefined,
): { model: string | undefined, brandIcon: BrandIconKey | null, brandLabel: string | null } {
  const cameraText = toDisplayText(camera)
  if (!cameraText) {
    return { model: undefined, brandIcon: null, brandLabel: null }
  }
  const normalized = normalizeCameraText(cameraText)
  const rule = cameraBrandRules.find(entry => matchesCameraBrand(normalized, entry))
  if (!rule) {
    return { model: cameraText, brandIcon: null, brandLabel: null }
  }
  // With a logo the brand is already shown, so the name is stripped as far as
  // it goes; without one the first prefix is dropped and the rest kept, since
  // the remainder is all the reader has to identify the body by.
  const model = rule.icon
    ? stripBrandPrefixes(cameraText, rule)
    : stripBrandPrefix(cameraText, rule)
  return { model, brandIcon: rule.icon ?? null, brandLabel: rule.label }
}
