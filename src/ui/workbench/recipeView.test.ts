import { describe, expect, it } from 'vitest'
import { RECIPES } from '../../data/recipes'
import { ITEM_MAP } from '../../data/items'
import { useCraftingStore } from '../../game/state/craftingStore'
import { useInventoryStore } from '../../game/state/inventoryStore'
import { resetRun } from '../../game/state/resetRun'
import type { Inventory } from '../../game/types'
import { displayTitle, ghostView, isDiscovered, pinCardView, recipeCard, tooltipTarget } from './recipeView'

const recipe = (id: string) => RECIPES.find((r) => r.id === id)!

describe('recipeCard (spec 09, B9)', () => {
  it('names the recipe and every ingredient with have/need counts', () => {
    const c = recipeCard(recipe('r-bone-club'), [{ item: 'bone', qty: 2 }])
    expect(c.title).toBe('Bone Club')
    expect(c.ingredients.map((i) => i.label)).toEqual(['Bone 1/3', 'Cloth 1/1'])
    expect(c.ingredients[0]).toMatchObject({ need: 3, have: 1, lack: 2 })
    expect(c.ingredients[1].lack).toBe(0)
  })

  it('shows the output count and the tool a recipe upgrades', () => {
    expect(recipeCard(recipe('r-revolver-cartridge'), []).title).toBe('Revolver Cartridges \u00d76')
    const shovel = recipeCard(recipe('r-sharpened-shovel'), [{ item: 'rusty-shovel', qty: 1 }])
    const tool = shovel.ingredients.find((i) => i.tool)!
    expect(tool).toMatchObject({ item: 'rusty-shovel', have: 0, need: 1, label: 'Rusty Shovel 0/1' })
  })

  it('every recipe gets a non-empty title and named, in-range rows', () => {
    for (const r of RECIPES) {
      const c = recipeCard(r, r.inputs.map((i) => ({ item: i.item, qty: i.qty + 5 })))
      expect(c.title.length).toBeGreaterThan(0)
      for (const i of c.ingredients) {
        expect(i.name).toBe(ITEM_MAP[i.item].name)
        expect(i.have).toBeGreaterThanOrEqual(0)
        expect(i.have).toBeLessThanOrEqual(i.need)
      }
    }
  })
})

const invWith = (...stacks: { item: string; qty: number }[]): Inventory =>
  ({ ...useInventoryStore.getState().inventory, slots: stacks }) as unknown as Inventory

describe('recipe marks, discovery, pin, tooltip, ghost (spec 09, B9/G1)', () => {
  it('marks missing rows with a cross and "need N more", owned with a tick', () => {
    const c = recipeCard(recipe('r-bone-club'), [{ item: 'bone', qty: 2 }])
    expect(c.ingredients[0]).toMatchObject({ mark: '\u2717', note: 'need 2 more' })
    expect(c.ingredients[1]).toMatchObject({ mark: '\u2713', note: 'have enough' })
  })

  it('shows ??? until one of each ingredient was held', () => {
    const r = recipe('r-bone-club')
    const card = recipeCard(r, [])
    expect(isDiscovered(r, ['bone'])).toBe(false)
    expect(displayTitle(r, ['bone'], card)).toBe('???')
    expect(isDiscovered(r, ['bone', 'cloth'])).toBe(true)
    expect(displayTitle(r, ['bone', 'cloth'], card)).toBe('Bone Club')
  })

  it('tracks collected items and clears them on a new run', () => {
    resetRun()
    useInventoryStore.setState({ inventory: invWith({ item: 'bone', qty: 1 }) })
    expect(useCraftingStore.getState().collectedItems).toContain('bone')
    useInventoryStore.setState({ inventory: invWith() })
    expect(useCraftingStore.getState().collectedItems).toContain('bone') // dropping it does not forget it
    useCraftingStore.getState().togglePin('r-bone-club')
    resetRun()
    expect(useCraftingStore.getState().pinnedRecipe).toBeNull()
    expect(useCraftingStore.getState().collectedItems).not.toContain('bone')
  })

  it('pin card follows the satchel and unpins on a second toggle', () => {
    const unlocked = ['r-bone-club'] as const
    expect(pinCardView(null, unlocked, invWith())).toBeNull()
    const a = pinCardView('r-bone-club', unlocked, invWith({ item: 'bone', qty: 1 }))!
    expect(a.craftable).toBe(false)
    expect(a.rows[0].label).toBe('Bone 1/3')
    const b = pinCardView('r-bone-club', unlocked, invWith({ item: 'bone', qty: 3 }, { item: 'cloth', qty: 1 }))!
    expect(b.craftable).toBe(true)
    expect(pinCardView('r-bone-club', [], invWith())).toBeNull()
    resetRun()
    useCraftingStore.getState().togglePin('r-bone-club')
    useCraftingStore.getState().togglePin('r-bone-club')
    expect(useCraftingStore.getState().pinnedRecipe).toBeNull()
  })

  it('hides the tooltip when the bench closes', () => {
    expect(tooltipTarget(true, 'r-bandage')).toBe('r-bandage')
    expect(tooltipTarget(false, 'r-bandage')).toBeNull()
  })

  it('ghost fill follows progress; owned rows are solid, missing are outlines', () => {
    const card = recipeCard(recipe('r-bone-club'), [{ item: 'bone', qty: 2 }])
    const g = ghostView(card, 1.5)
    expect(g.fill).toBe(1)
    expect(g.rows).toEqual([{ item: 'bone', solid: false }, { item: 'cloth', solid: true }])
    expect(ghostView(card, -1).fill).toBe(0)
  })
})