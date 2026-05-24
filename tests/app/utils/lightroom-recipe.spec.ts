import { describe, expect, it } from 'vitest'
import { parseLightroomRecipeView } from '../../../app/utils/lightroom-recipe'

describe('app/utils/lightroom-recipe', () => {
  it('returns null for empty / whitespace input', () => {
    expect(parseLightroomRecipeView(undefined)).toBeNull()
    expect(parseLightroomRecipeView('   ')).toBeNull()
  })

  it('parses a structured json payload into adjustment groups', () => {
    const recipe = JSON.stringify({
      processVersion: 'Version 5.0',
      profile: 'Adobe Color',
      basic: { exposure: 0.5, contrast: 20, saturation: 0 },
    })
    const view = parseLightroomRecipeView(recipe)
    expect(view).not.toBeNull()
    expect(view?.processVersion).toBe('Version 5.0')
    expect(view?.profile).toBe('Adobe Color')
    const basic = view?.groups.find(group => group.key === 'basic')
    expect(basic).toBeDefined()
    // saturation === 0 is the default and is dropped; exposure/contrast remain.
    expect(basic?.items.map(item => item.key).sort()).toEqual(['contrast', 'exposure'])
  })

  it('drops adjustments that equal their default', () => {
    const recipe = JSON.stringify({ basic: { exposure: 0, contrast: 0 } })
    const view = parseLightroomRecipeView(recipe)
    expect(view).toBeNull()
  })

  it('parses a tone curve payload with named curve', () => {
    const recipe = JSON.stringify({ toneCurve: { name: 'Strong Contrast' } })
    const view = parseLightroomRecipeView(recipe)
    expect(view?.toneCurve?.name).toBe('Strong Contrast')
  })

  it('parses tone curve points (requiring at least two points)', () => {
    const recipe = JSON.stringify({ toneCurve: { composite: [[0, 0], [255, 255]] } })
    const view = parseLightroomRecipeView(recipe)
    expect(view?.toneCurve?.composite).toEqual([{ x: 0, y: 0 }, { x: 255, y: 255 }])
  })

  it('falls back to legacy token parsing for non-json strings', () => {
    const view = parseLightroomRecipeView('PV Version 5.0 · Exp 0.50 · Ctr 25')
    expect(view).not.toBeNull()
    expect(view?.processVersion).toBe('Version 5.0')
    const basic = view?.groups.find(group => group.key === 'basic')
    expect(basic?.items.map(item => item.key).sort()).toEqual(['contrast', 'exposure'])
  })

  it('returns null when json has no recognisable fields', () => {
    expect(parseLightroomRecipeView(JSON.stringify({ unknown: 'value' }))).toBeNull()
  })
})
