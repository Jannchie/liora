import { describe, expect, it } from 'vitest'
import { parseLlrRecipeView } from '../../../app/utils/llr-recipe'

// Shape mirrors the `llr:Settings` blob LLR embeds on export.
function buildSettings(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    recipe: {
      exposure: 0,
      contrast: 0,
      highlights: 0,
      shadows: 0,
      whites: 0,
      blacks: 0,
      vibrance: 0,
      saturation: 0,
      temperature: 6500,
      tint: 0,
      clarity: 0,
      dehaze: 0,
      lensDistortion: 100,
      lensVignetting: 0,
    },
    hslHue: [0, 0, 0, 0, 0, 0, 0, 0],
    hslSat: [0, 0, 0, 0, 0, 0, 0, 0],
    hslLum: [0, 0, 0, 0, 0, 0, 0, 0],
    grading: { shH: 0, shS: 0, mdH: 0, mdS: 0, hlH: 0, hlS: 0, blend: 50, balance: 0 },
    curve: {
      rgb: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      red: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      green: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      blue: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      parametric: { highlights: 0, lights: 0, darks: 0, shadows: 0, shadowSplit: 25, midtoneSplit: 50, highlightSplit: 75 },
    },
    crop: { cx: 0.5, cy: 0.5, w: 1, h: 1, angle: 0, flipH: false, flipV: false, orientation: 0 },
    aspect: 'orig',
    dcp: '',
    denoise: { enabled: false, model: 'wavelet', amount: 100 },
    ...overrides,
  })
}

describe('app/utils/llr-recipe', () => {
  it('returns null for empty, whitespace, and non-json input', () => {
    expect(parseLlrRecipeView(undefined)).toBeNull()
    expect(parseLlrRecipeView('   ')).toBeNull()
    expect(parseLlrRecipeView('not json')).toBeNull()
    expect(parseLlrRecipeView('[1,2]')).toBeNull()
  })

  it('returns null when every value sits at its llr default', () => {
    expect(parseLlrRecipeView(buildSettings())).toBeNull()
  })

  it('groups sliders the way llr does and drops defaults', () => {
    const view = parseLlrRecipeView(buildSettings({
      recipe: {
        exposure: -0.3,
        contrast: 7,
        highlights: 28,
        shadows: 0,
        temperature: 5700,
        tint: -9,
        dehaze: -10,
        clarity: 0,
        lensDistortion: 100,
        lensVignetting: 40,
      },
    }))
    expect(view?.groups.map(group => group.key)).toEqual(['tone', 'presence', 'color', 'lens'])
    const tone = view?.groups.find(group => group.key === 'tone')
    // shadows === 0 is the default and is dropped.
    expect(tone?.items.map(item => item.key)).toEqual(['exposure', 'contrast', 'highlights'])
    const color = view?.groups.find(group => group.key === 'color')
    // temperature 6500 is the default; 5700 is an edit.
    expect(color?.items.map(item => item.key)).toEqual(['temperature', 'tint'])
    const lens = view?.groups.find(group => group.key === 'lens')
    // Distortion 100 is LLR's default; vignetting 0 is, so only the 40 shows.
    expect(lens?.items.map(item => item.key)).toEqual(['lensVignetting'])
  })

  it('reads the eight hsl bands positionally', () => {
    const view = parseLlrRecipeView(buildSettings({
      hslHue: [0, -15, -25, 29, 0, -31, 0, 0],
    }))
    const hsl = view?.groups.find(group => group.key === 'hsl')
    expect(hsl?.items.map(item => item.label)).toEqual([
      'Orange Hue',
      'Yellow Hue',
      'Green Hue',
      'Blue Hue',
    ])
    expect(hsl?.items[0]?.value).toBe(-15)
  })

  it('folds grading hue to 0-360 and hides hues that tint nothing', () => {
    const view = parseLlrRecipeView(buildSettings({
      grading: { shH: -151, shS: 40, mdH: -27, mdS: 0, hlH: -2, hlS: 37, blend: 50, balance: 0 },
    }))
    const grading = view?.groups.find(group => group.key === 'grading')
    expect(grading?.items.map(item => item.key)).toEqual([
      'sh-hue',
      'sh-saturation',
      'hl-hue',
      'hl-saturation',
    ])
    // -151 folds to 209, matching the value LLR writes to llr:GradingShadowHue.
    expect(grading?.items[0]?.value).toBe(209)
    expect(grading?.items[2]?.value).toBe(358)
  })

  it('drops identity curves and rescales real ones to the 0-255 plot space', () => {
    const identity = parseLlrRecipeView(buildSettings({
      recipe: { exposure: 1 },
    }))
    expect(identity?.toneCurve).toBeUndefined()

    const view = parseLlrRecipeView(buildSettings({
      curve: {
        rgb: [{ x: 0, y: 0 }, { x: 0.5, y: 0.6 }, { x: 1, y: 1 }],
        red: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      },
    }))
    expect(view?.toneCurve?.red).toBeUndefined()
    expect(view?.toneCurve?.composite).toEqual([
      { x: 0, y: 0 },
      { x: 127.5, y: 153 },
      { x: 255, y: 255 },
    ])
  })

  it('surfaces parametric curve edits as their own group', () => {
    const view = parseLlrRecipeView(buildSettings({
      curve: { parametric: { lights: 12, shadowSplit: 25, midtoneSplit: 60 } },
    }))
    const parametric = view?.groups.find(group => group.key === 'parametric-curve')
    // shadowSplit 25 is the default; lights and the moved midtoneSplit remain.
    expect(parametric?.items.map(item => item.key)).toEqual(['lights', 'midtoneSplit'])
  })

  it('describes denoise and profile only when they carry information', () => {
    expect(parseLlrRecipeView(buildSettings({ recipe: { exposure: 1 } }))?.denoise).toBeUndefined()
    const view = parseLlrRecipeView(buildSettings({
      denoise: { enabled: true, model: 'wavelet', amount: 80 },
      dcp: 'Sony ILCE-7RM5 Camera Standard',
      aspect: '16:9',
      version: '1',
    }))
    expect(view?.denoise).toBe('wavelet 80%')
    expect(view?.profile).toBe('Sony ILCE-7RM5 Camera Standard')
    expect(view?.aspect).toBe('16:9')
    expect(view?.version).toBe('1')
  })

  it('treats the untouched "orig" aspect as no framing choice', () => {
    expect(parseLlrRecipeView(buildSettings({ recipe: { exposure: 1 } }))?.aspect).toBeUndefined()
  })
})
