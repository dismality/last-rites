import { describe, expect, it } from 'vitest'
import { RECIPES } from '../../data/recipes'
import { ITEM_MAP } from '../../data/items'
import { recipeCard } from './recipeView'

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
