import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { RECIPES, RECIPE_MAP } from '../../data/recipes'
import { ITEM_MAP } from '../../data/items'
import { BLUEPRINTS } from '../../data/blueprints'
import { CASES } from '../../data/cases'
import { createInventory, addItem } from './inventory'
import {
  blueprintStatus,
  bookRecipes,
  canCraftTiered,
  effectiveRecipe,
  recipeCost,
  recipeDamage,
  tierStats,
} from './tieredCrafting'
import type { Inventory, ItemId } from '../types'

const give = (items: [ItemId, number][]): Inventory =>
  items.reduce((inv, [id, n]) => addItem(inv, id, n).inv, createInventory())

describe('tier data (Req 27.1, 27.2)', () => {
  it('every recipe has a tier; the design table groups them', () => {
    const tier = (id: string) => RECIPE_MAP[id as keyof typeof RECIPE_MAP].tier
    expect(['r-bone-club', 'r-bandage', 'r-tallow-candle', 'r-lantern-refill'].map(tier)).toEqual([1, 1, 1, 1])
    expect(['r-sharpened-shovel', 'r-holy-water-flask', 'r-lantern-trap'].map(tier)).toEqual([2, 2, 2])
    expect(['r-nail-bomb', 'r-blessed-rounds'].map(tier)).toEqual([3, 3])
  })
  it('Tier 2 needs a crafted component plus 5 to 7 materials', () => {
    for (const r of RECIPES.filter((x) => x.tier === 2 && !x.tieredOnly)) {
      const inputs = effectiveRecipe(r, true).inputs
      const comps = inputs.filter((i) => ITEM_MAP[i.item].kind === 'component')
      const mats = inputs.filter((i) => ITEM_MAP[i.item].kind !== 'component').reduce((n, i) => n + i.qty, 0)
      expect(comps.length, r.id).toBeGreaterThan(0)
      expect(mats, r.id).toBeGreaterThanOrEqual(5)
      expect(mats, r.id).toBeLessThanOrEqual(7)
    }
  })
  it('Tier 3 needs a blueprint from 2 real clues plus a rare material', () => {
    const allClues = new Set<string>(CASES.flatMap((c) => c.clues.map((k) => k.id)))
    for (const r of RECIPES.filter((x) => x.tier === 3)) {
      const bp = r.tiered?.blueprint
      expect(bp, r.id).toBeDefined()
      for (const c of BLUEPRINTS[bp!].clues) expect(allClues.has(c), c).toBe(true)
      const rare = effectiveRecipe(r, true).inputs.some((i) => i.item === 'silver-filings' || i.item === 'grave-salt')
      expect(rare, r.id).toBe(true)
    }
  })
  it('every component is made by a recipe, and every component recipe is tiers-only', () => {
    for (const item of Object.values(ITEM_MAP).filter((i) => i.kind === 'component')) {
      const maker = RECIPES.find((r) => r.output.item === item.id)
      expect(maker?.tieredOnly, item.id).toBe(true)
    }
  })
})

describe('Property 23: Tier damage and cost rise together', () => {
  // Validates Req 27.3.
  it('for any two tiers a < b, b has at least the minimum damage and cost of a', () => {
    const stats = tierStats(true)
    fc.assert(
      fc.property(fc.constantFrom(0, 1, 2), fc.constantFrom(0, 1, 2), (i, j) => {
        fc.pre(i < j)
        const a = stats[i]
        const b = stats[j]
        expect(b.minCost).toBeGreaterThanOrEqual(a.minCost)
        if (a.minDamage !== null && b.minDamage !== null) expect(b.minDamage).toBeGreaterThanOrEqual(a.minDamage)
      }),
    )
    // Every tier has a weapon, so the damage half is never vacuous.
    expect(stats.every((s) => s.minDamage !== null)).toBe(true)
  })
  it('a lantern trap counts its whole burn', () => {
    expect(recipeDamage(RECIPE_MAP['r-lantern-trap'])).toBe(50)
    expect(recipeDamage(RECIPE_MAP['r-bandage'])).toBeNull()
  })
  it('a component counts as the materials that make it', () => {
    // Iron Head (2 nails + 1 plank) + 2 nails + 1 plank + 2 cloth.
    expect(recipeCost(RECIPE_MAP['r-sharpened-shovel'], true)).toBe(8)
    expect(recipeCost(RECIPE_MAP['r-sharpened-shovel'], false)).toBe(2)
  })
})

describe('canCraftTiered (Req 27.2, 27.4, 27.5)', () => {
  const r = RECIPE_MAP['r-sharpened-shovel']
  it('reports the missing component by item', () => {
    const inv = give([['rusty-shovel', 1], ['iron-nail', 2], ['wood-plank', 1], ['cloth', 2]])
    const res = canCraftTiered(inv, r, true, [])
    expect(res.ok).toBe(false)
    expect(res.missingComponents).toEqual(['iron-head'])
    expect(canCraftTiered(addItem(inv, 'iron-head', 1).inv, r, true, []).ok).toBe(true)
  })
  it('with tiers off the flat recipe stands', () => {
    const inv = give([['rusty-shovel', 1], ['iron-nail', 2]])
    expect(canCraftTiered(inv, r, false, []).ok).toBe(true)
    expect(canCraftTiered(inv, r, true, []).ok).toBe(false)
  })
  it('Tier 3 waits on both clues of its blueprint', () => {
    const rounds = RECIPE_MAP['r-blessed-rounds']
    const inv = give([['holy-water', 2], ['silver-filings', 2], ['black-powder', 2], ['lead-shot', 2]])
    const [a, b] = BLUEPRINTS['bp-blessed-rounds'].clues
    expect(canCraftTiered(inv, rounds, true, []).blueprint).toMatchObject({ have: 0, need: 2, ready: false })
    expect(canCraftTiered(inv, rounds, true, [a]).ok).toBe(false)
    expect(canCraftTiered(inv, rounds, true, [a, b]).ok).toBe(true)
    expect(canCraftTiered(inv, rounds, false, []).blueprint).toBeNull()
    expect(blueprintStatus('bp-blessed-rounds', [b]).have).toBe(1)
  })
  it('component recipes are in the book only with tiers on', () => {
    expect(bookRecipes(true).some((x) => x.id === 'r-iron-head')).toBe(true)
    expect(bookRecipes(false).some((x) => x.id === 'r-iron-head')).toBe(false)
  })
})
