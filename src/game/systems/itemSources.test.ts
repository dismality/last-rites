import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { RECIPES } from '../../data/recipes'
import { SPAWN_POINTS } from '../../data/zones'
import { ITEM_MAP } from '../../data/items'
import { recipeCard, unknownIngredientText, unknownRecipeTip } from '../../ui/workbench/recipeView'
import {
  ELITE_LABEL,
  MERCHANT_LABEL,
  itemSources,
  nearestSource,
  sourcePhrases,
  type SourceWorld,
} from './itemSources'

const world = (over: Partial<SourceWorld> = {}): SourceWorld => ({
  materials: {},
  dugOnDay: {},
  day: 1,
  phase: 'day',
  collectedFixed: [],
  ...over,
})

describe('itemSources', () => {
  it('every recipe ingredient and tool has at least one source', () => {
    const missing: string[] = []
    for (const r of RECIPES) {
      const items = [...r.inputs.map((i) => i.item), ...(r.consumesTool ? [r.consumesTool] : [])]
      for (const item of items) if (itemSources(item).length === 0) missing.push(`${r.id}: ${item}`)
    }
    expect(missing).toEqual([])
  })

  it('names grave mounds and coffins for bone and the shop for powder', () => {
    expect(itemSources('bone').map((s) => s.label)).toEqual(
      expect.arrayContaining(['dug from grave mounds', 'found in coffins', 'in the catacomb walls']),
    )
    const powder = itemSources('black-powder').map((s) => s.label)
    expect(powder).toContain(MERCHANT_LABEL)
    expect(powder).toContain(ELITE_LABEL)
  })

  it('lists at most two places, nearest first', () => {
    // Standing in the catacombs, the catacomb walls come before the grounds.
    const cat = SPAWN_POINTS.find((p) => p.id === 'cat-wall-a')!
    const near = sourcePhrases('bone', { x: cat.position[0], z: cat.position[2] })
    expect(near).toHaveLength(2)
    expect(near[0]).toBe('in the catacomb walls')
    fc.assert(
      fc.property(fc.constantFrom(...Object.keys(ITEM_MAP)), fc.integer({ min: -60, max: 60 }), (id, x) => {
        expect(sourcePhrases(id as never, { x, z: 0 }).length).toBeLessThanOrEqual(2)
      }),
    )
  })
})

describe('nearestSource (Mark on map)', () => {
  it('picks the nearest undug grave for bone', () => {
    const t = nearestSource('bone', { x: 22, z: 24 }, world())
    expect(t).toMatchObject({ x: 22, z: 24, name: 'Dug from grave mounds' })
  })

  it('skips a grave already dug today and falls to the next place', () => {
    const t = nearestSource('bone', { x: 22, z: 24 }, world({ dugOnDay: { 'grave-low-field': 1 } }))
    expect(t).not.toBeNull()
    expect(`${t!.x},${t!.z}`).not.toBe('22,24')
  })

  it('skips looted coffins and shelves: only stacks still lying count', () => {
    const t = nearestSource('lead-shot', { x: 28, z: -12 }, world())
    expect(t).toBeNull() // nothing lies at any coffin
    const lying = nearestSource(
      'lead-shot',
      { x: 0, z: 0 },
      world({ materials: { 'grounds-coffin-south': [{ item: 'lead-shot', qty: 1 }] } }),
    )
    expect(lying).toMatchObject({ x: -8, z: 30 })
  })

  it('has no place for items only the merchant or elites carry', () => {
    expect(nearestSource('silver-filings', { x: 0, z: 0 }, world())).toBeNull()
  })

  it('does not mark a taken fixed spawn, and hides the night-only locket by day', () => {
    expect(nearestSource('bone-whistle', { x: 0, z: 0 }, world())).toMatchObject({ x: -21, z: -48 })
    expect(nearestSource('bone-whistle', { x: 0, z: 0 }, world({ collectedFixed: ['fx-bone-whistle'] }))).toBeNull()
    expect(nearestSource('childs-locket', { x: 0, z: 0 }, world())).toBeNull()
    expect(nearestSource('childs-locket', { x: 0, z: 0 }, world({ phase: 'night' }))).not.toBeNull()
  })
})

describe('recipe card text', () => {
  const bandage = RECIPES.find((r) => r.id === 'r-bandage')!
  const club = RECIPES.find((r) => r.id === 'r-bone-club')!

  it('a known recipe with a shortfall says where to find it', () => {
    const card = recipeCard(bandage, [{ item: 'cloth', qty: 1 }])
    expect(card.ingredients[0].label).toBe('Cloth 1/2')
    expect(card.ingredients[0].found).toMatch(/^Found: .+/)
    expect(recipeCard(bandage, []).ingredients[0].found).toBe('')
  })

  it('an unknown recipe keeps its ingredients unnamed but gives sources', () => {
    const card = recipeCard(club, [
      { item: 'bone', qty: 3 },
      { item: 'cloth', qty: 1 },
    ])
    expect(unknownIngredientText(card.ingredients[0])).toMatch(/^\?\?\? · .*grave mounds/)
    expect(unknownIngredientText(card.ingredients[0])).not.toMatch(/bone/i)
  })

  it('the unknown tooltip lists what you have and what is still to find', () => {
    const card = recipeCard(bandage, [{ item: 'cloth', qty: 2 }])
    const tip = unknownRecipeTip(card, [])
    expect(tip).toMatch(/^\?\?\? Needs 1 ingredient\. You have: nothing yet\. Still to find: something .+\.$/)
    const club2 = recipeCard(club, [{ item: 'bone', qty: 3 }])
    const tip2 = unknownRecipeTip(club2, ['cloth'])
    expect(tip2).toMatch(/Needs 2 ingredients\. You have: Cloth\. Still to find: something .*grave mounds.*\./)
  })
})
