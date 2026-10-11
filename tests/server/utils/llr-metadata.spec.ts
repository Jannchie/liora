import { describe, expect, it } from 'vitest'
import {
  buildLlrRecipeFromTags,
  compactLlrSettings,
  isLlrExport,
  rebuildLlrSettingsFromAttributes,
} from '../../../server/utils/llr-metadata'

describe('server/utils/llr-metadata', () => {
  it('recognises an llr export by its software or xmp toolkit', () => {
    expect(isLlrExport({ Software: 'LLR' })).toBe(true)
    expect(isLlrExport({ Software: 'LLR 1.2' })).toBe(true)
    expect(isLlrExport({ Software: 'ILCE-7RM5 v1.10', XMPToolkit: 'LLR' })).toBe(true)
    expect(isLlrExport({ Software: 'Adobe Lightroom Classic 13.0' })).toBe(false)
    expect(isLlrExport({ Software: 'LLRX' })).toBe(false)
    expect(isLlrExport({})).toBe(false)
  })

  it('reads the settings blob from the llr group, not a flattened tag', () => {
    const recipe = buildLlrRecipeFromTags({
      'XMP-llr:Version': 1,
      'XMP-llr:Settings': JSON.stringify({ recipe: { exposure: 0.5 } }),
      // Another namespace's tags must not leak in.
      'Settings': '{"recipe":{"exposure":9}}',
      'XMP-other:Version': 7,
    })
    expect(JSON.parse(recipe!)).toEqual({ recipe: { exposure: 0.5 }, version: '1' })
  })

  it('keeps a snapshot without global sliders', () => {
    const recipe = buildLlrRecipeFromTags({
      'XMP-llr:Settings': JSON.stringify({ masks: [{ id: 'm', components: [], adjust: { exposure: 1 } }] }),
    })
    expect(JSON.parse(recipe!).masks).toHaveLength(1)
  })

  it('compacts strokes and guides to what a viewer can read', () => {
    const compact = compactLlrSettings({
      masks: [{
        id: 'm',
        components: [
          { type: 'brush', strokes: [{ points: [[0, 0], [1, 1]] }, { points: [[0.5, 0.5]] }] },
          { type: 'radial', cx: 0.5 },
        ],
      }],
      erase: [{ id: 'a', points: [[0, 0]] }, { id: 'b', points: [[0, 0]], mode: 'heal' }, { id: 'c', points: [] }],
      crop: { w: 1, h: 1, xf: { vertical: 10, guides: [[0, 0, 1, 1]] } },
      relight: { ambient: 0, lights: [{ id: 'l1', u: 0.2, v: 0.4, ev: 1, kind: 'sun' }] },
    })
    expect(compact.masks).toEqual([{ id: 'm', components: [{ type: 'brush', strokes: 2 }, { type: 'radial', cx: 0.5 }] }])
    expect(compact.erase).toEqual({ fill: 2, heal: 1 })
    expect(compact.crop).toEqual({ w: 1, h: 1, xf: { vertical: 10 } })
    expect(compact.relight).toEqual({ ambient: 0, lights: [{ ev: 1, kind: 'sun' }] })
  })

  it('falls back to the flat attributes when the blob is missing', () => {
    const settings = rebuildLlrSettingsFromAttributes({
      'XMP-llr:Exposure': '+0.30',
      'XMP-llr:Temperature': 5600,
      'XMP-llr:HslHue': '0,-15,0,0,0,0,0,0',
      'XMP-llr:GradingShadowHue': 209,
      'XMP-llr:GradingShadowSaturation': 40,
      'XMP-llr:ParametricLights': 12,
      'XMP-llr:ToneCurveRgb': ['0.0000, 0.0000', '0.5000, 0.6000', '1.0000, 1.0000'],
      'XMP-llr:DenoiseAmount': 50,
      'XMP-llr:DenoiseAuto': '1',
      'XMP-llr:HasCrop': 'True',
      'XMP-llr:CropWidth': 0.8,
      'XMP-llr:CropHeight': 0.9,
      'XMP-llr:CropOrientation': 90,
    })
    expect(settings).toMatchObject({
      recipe: { exposure: 0.3, temperature: 5600 },
      hslHue: [0, -15, 0, 0, 0, 0, 0, 0],
      grading: { shH: 209, shS: 40 },
      curve: {
        parametric: { lights: 12 },
        rgb: [{ x: 0, y: 0 }, { x: 0.5, y: 0.6 }, { x: 1, y: 1 }],
      },
      denoise: { enabled: true, auto: true, amount: 50 },
      crop: { w: 0.8, h: 0.9, orientation: 90, flipH: false, flipV: false },
    })
  })

  it('returns nothing for a file without llr tags', () => {
    expect(buildLlrRecipeFromTags({ 'XMP-llr:Settings': 'not json' })).toBeUndefined()
    expect(buildLlrRecipeFromTags({})).toBeUndefined()
  })
})
