import { describe, expect, it } from 'vitest'
import { parseLlrRecipeView as parseWith } from '../../../app/utils/llr-recipe'
import en from '../../../i18n/locales/en.json'

// The English catalogue stands in for vue-i18n: a dotted key, `{name}` params.
function translate(key: string, params: Record<string, unknown> = {}): string {
  let message: unknown = en
  for (const part of key.split('.')) {
    message = (message as Record<string, unknown> | undefined)?.[part]
  }
  if (typeof message !== 'string') {
    throw new TypeError(`missing message ${key}`)
  }
  return message.replaceAll(/\{(\w+)\}/g, (_, name: string) => String(params[name]))
}

function parseLlrRecipeView(value: string | undefined) {
  return parseWith(value, translate)
}

function fact(view: ReturnType<typeof parseLlrRecipeView>, key: string): string | undefined {
  return view?.facts.find(entry => entry.key === key)?.value
}

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
    const parametric = view?.groups.find(group => group.key === 'curve')
    // shadowSplit 25 is the default; lights and the moved midtoneSplit remain.
    expect(parametric?.items.map(item => item.key)).toEqual(['lights', 'midtoneSplit'])
    expect(parametric?.label).toBe('Parametric Curve')
  })

  it('describes denoise and profile only when they carry information', () => {
    expect(fact(parseLlrRecipeView(buildSettings({ recipe: { exposure: 1 } })), 'denoise')).toBeUndefined()
    const view = parseLlrRecipeView(buildSettings({
      denoise: { enabled: true, model: 'wavelet', amount: 80 },
      dcp: 'Sony ILCE-7RM5 Camera Standard',
      aspect: '16:9',
      version: '1',
    }))
    expect(fact(view, 'denoise')).toBe('wavelet · 80%')
    // `dcp` is the camera style; `profile` is the rendering pipeline.
    expect(fact(view, 'dcp')).toBe('Sony ILCE-7RM5 Camera Standard')
    expect(fact(view, 'aspect')).toBe('16:9')
    expect(view?.version).toBe('1')
  })

  it('treats the untouched "orig" aspect as no framing choice', () => {
    expect(fact(parseLlrRecipeView(buildSettings({ recipe: { exposure: 1 } })), 'aspect')).toBeUndefined()
    expect(fact(parseLlrRecipeView(buildSettings({ aspect: 'custom:7:5' })), 'aspect')).toBe('7:5')
  })

  // A recipe whose global sliders all sit at their defaults is not an empty
  // recipe: the work can live entirely in a mask.
  it('reads a recipe whose only edit is a mask', () => {
    const view = parseLlrRecipeView(buildSettings({
      masks: [{
        id: 'crl3lv',
        enabled: true,
        invert: false,
        components: [
          { op: 'add', invert: false, type: 'radial', cx: 0.5, cy: 0.76, rx: 0.22, ry: 0.3, angle: 0, feather: 1 },
          { op: 'intersect', invert: false, type: 'luminance', lo: 0, hi: 45, featherLo: 25, featherHi: 25 },
        ],
        adjust: { exposure: 0.22, shadows: 40, temperature: 0, tint: 0, saturation: 0, vibrance: 0, highlights: 0, clarity: 0, dehaze: 0, hue: 0, tintHue: 0, tintSat: 0 },
        name: 'Subject shadows',
      }],
    }))
    expect(view).not.toBeNull()
    expect(view?.groups).toEqual([])
    expect(view?.masks).toHaveLength(1)
    const mask = view!.masks[0]!
    expect(mask.name).toBe('Subject shadows')
    expect(mask.disabled).toBe(false)
    // The leading component has nothing to combine with, so it carries no operator.
    expect(mask.components).toEqual(['Radial gradient · feather 100%', '∩ Luminance range 0–45'])
    expect(mask.items.map(item => item.label)).toEqual(['Exposure', 'Shadows'])
    expect(mask.items[0]?.value).toBeCloseTo(0.22)
  })

  it('describes every mask component type', () => {
    const view = parseLlrRecipeView(buildSettings({
      masks: [{
        id: 'm',
        enabled: true,
        invert: false,
        components: [
          { op: 'add', invert: false, type: 'ai', kind: 'sky' },
          { op: 'subtract', invert: false, type: 'brush', strokes: 3 },
          { op: 'intersect', invert: false, type: 'depth', lo: 10, hi: 60, featherLo: 5, featherHi: 5 },
          { op: 'add', invert: true, type: 'color', hue: Math.PI / 2, hueWidth: Math.PI / 18, chromaLo: 0, chromaHi: 1 },
        ],
        adjust: { exposure: -0.4 },
      }],
    }))
    expect(view?.masks[0]?.components).toEqual([
      'Sky (AI)',
      '− Brush · 3 strokes',
      '∩ Depth range 10–60',
      '+ Color range 90° ± 10° · inverted',
    ])
  })

  it('shows a mask colour cast as a hue with its strength', () => {
    const view = parseLlrRecipeView(buildSettings({
      masks: [{ id: 'm', enabled: true, invert: false, components: [{ op: 'add', type: 'linear' }], adjust: { tintHue: -150, tintSat: 30, moire: 40 } }],
    }))
    const items = view?.masks[0]?.items ?? []
    expect(items.map(item => item.key)).toEqual(['moire', 'tintHue', 'tintSat'])
    expect(items[1]).toMatchObject({ value: 210, track: 'hue' })
  })

  it('skips masks that select nothing and adjust nothing', () => {
    const view = parseLlrRecipeView(buildSettings({
      recipe: { exposure: 1 },
      masks: [{ id: 'empty', enabled: true, invert: false, components: [], adjust: {} }],
    }))
    expect(view?.masks).toEqual([])
  })

  it('flags a mask that is inverted or switched off', () => {
    const view = parseLlrRecipeView(buildSettings({
      masks: [{
        id: 'm1',
        enabled: false,
        invert: true,
        components: [{ op: 'add', invert: true, type: 'linear', x0: 0.5, y0: 0.15, x1: 0.5, y1: 0.55 }],
        adjust: { exposure: -0.5 },
      }],
    }))
    const mask = view!.masks[0]!
    expect(mask.disabled).toBe(true)
    expect(mask.inverted).toBe(true)
    expect(mask.components).toEqual(['Linear gradient · inverted'])
  })

  it('reads the creative look, its style and dro', () => {
    const view = parseLlrRecipeView(buildSettings({
      look: { contrast: 22, highlights: -30, shadows: -31, white: -26, black: 0, fade: 0, hue: 0, saturation: -10, clarity: 20 },
      lookStyle: 'FL',
      dro: 1,
      droLevel: 70,
    }))
    expect(fact(view, 'lookStyle')).toBe('FL')
    expect(fact(view, 'dro')).toBe('Lv70')
    expect(view?.groups.find(group => group.key === 'look')?.items.map(item => item.label)).toEqual([
      'Contrast',
      'Highlights',
      'Shadows',
      'Whites',
      'Saturation',
      'Clarity',
    ])
  })

  // Strength zero is off whatever level is selected — the same way LLR's own
  // worker resolves the two fields.
  it('reports dro off when the strength is zero', () => {
    expect(fact(parseLlrRecipeView(buildSettings({ recipe: { exposure: 1 }, dro: 0, droLevel: 70 })), 'dro')).toBe('Off')
  })

  it('reports dro auto when no level is chosen', () => {
    expect(fact(parseLlrRecipeView(buildSettings({ recipe: { exposure: 1 }, dro: 1, droLevel: -1 })), 'dro')).toBe('Auto 1')
  })

  it('describes the current denoiser block', () => {
    const view = parseLlrRecipeView(buildSettings({
      denoise: { enabled: true, auto: true, amount: 100, edge: 100, chroma: 50 },
    }))
    // edge moved off 50, chroma did not.
    expect(fact(view, 'denoise')).toBe('auto · 100% · edge 100')
  })

  it('reports geometry only for the parts that moved', () => {
    expect(fact(parseLlrRecipeView(buildSettings({ recipe: { exposure: 1 } })), 'geometry')).toBeUndefined()
    const view = parseLlrRecipeView(buildSettings({
      crop: { cx: 0.5, cy: 0.56, w: 0.88, h: 0.88, angle: 1.5, flipH: true, flipV: false, orientation: 90, xf: { vertical: 0, horizontal: 0, aspect: 0, scale: 105, offsetX: 0, offsetY: 0 } },
    }))
    // `orientation` is stored in degrees, not quarter turns.
    expect(fact(view, 'geometry')).toBe('crop 88% × 88% · straighten 1.5° · rotate 90° · flip horizontal')
    expect(fact(view, 'transform')).toBe('scale 105%')
  })

  it('reads the effects panels, skipping one whose amount is zero', () => {
    const view = parseLlrRecipeView(buildSettings({
      recipe: {
        sharpAmount: 40,
        sharpRadius: 1.2,
        sharpDetail: 25,
        grainAmount: 0,
        grainSize: 60,
        vigAmount: -20,
        vigFeather: 70,
        defringePurple: 15,
      },
    }))
    expect(view?.groups.map(group => group.key)).toEqual(['sharpen', 'defringe', 'vignette'])
    expect(view?.groups[0]?.items.map(item => item.key)).toEqual(['sharpAmount', 'sharpRadius'])
    expect(view?.groups[0]?.label).toBe('Sharpening')
  })

  it('reads relight as a group with one row per light', () => {
    const view = parseLlrRecipeView(buildSettings({
      relight: {
        lights: [{ kind: 'spot', ev: 1.5, lift: 0.2, color: '#ffffff' }, { ev: -0.5 }],
        ambient: -0.5,
        wrap: 0.3,
        falloff: 1,
        shadows: 0.8,
      },
    }))
    const relight = view?.groups.find(group => group.key === 'relight')
    expect(relight?.items.map(item => item.label)).toEqual(['Existing light', 'Spot 1', 'Lamp 2'])
  })

  it('counts erase strokes by kind, compacted or not', () => {
    expect(fact(parseLlrRecipeView(buildSettings({ erase: { fill: 2, heal: 1 } })), 'erase')).toBe('Erase ×2 · Heal ×1')
    expect(fact(parseLlrRecipeView(buildSettings({ erase: [{ id: 'a', points: [] }, { id: 'b', points: [], mode: 'heal' }] })), 'erase')).toBe('Erase ×1 · Heal ×1')
  })

  it('marks bypassed panels where they are shown', () => {
    const view = parseLlrRecipeView(buildSettings({
      recipe: { clarity: 20, exposure: 0.5 },
      curve: { rgb: [{ x: 0, y: 0 }, { x: 0.5, y: 0.6 }, { x: 1, y: 1 }] },
      masks: [{ id: 'm', enabled: true, invert: false, components: [{ op: 'add', type: 'linear' }], adjust: { exposure: 1 } }],
      lookStyle: 'FL',
      bypass: ['presence', 'curve', 'masks', 'look'],
    }))
    expect(view?.groups.find(group => group.key === 'presence')?.bypassed).toBe(true)
    expect(view?.groups.find(group => group.key === 'tone')?.bypassed).toBeUndefined()
    expect(view?.toneCurveBypassed).toBe(true)
    expect(view?.masksBypassed).toBe(true)
    expect(view?.facts.find(entry => entry.key === 'lookStyle')?.bypassed).toBe(true)
  })

  it('reports camera-match toggles', () => {
    const view = parseLlrRecipeView(buildSettings({
      sonyAdvancedColour: true,
      sonyCameraMatch: false,
    }))
    expect(view?.toggles).toEqual(['Advanced colour', 'Camera match off'])
  })

  it('reads the rendering profile separately from the camera style', () => {
    const view = parseLlrRecipeView(buildSettings({ recipe: { exposure: 1 }, profile: 'sony', dcp: 'FL' }))
    expect(fact(view, 'profile')).toBe('Sony engine')
    expect(fact(view, 'dcp')).toBe('FL')
  })

  it('draws grading hues and the white balance on their own scales', () => {
    const view = parseLlrRecipeView(buildSettings({
      recipe: { temperature: 5200 },
      grading: { shH: 30, shS: 20 },
    }))
    expect(view?.groups.find(group => group.key === 'color')?.items[0]?.track).toBe('temperature')
    expect(view?.groups.find(group => group.key === 'grading')?.items[0]).toMatchObject({ key: 'sh-hue', track: 'hue', label: 'Shadows Hue' })
  })
})
