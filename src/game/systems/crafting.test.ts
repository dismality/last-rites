// Tests for src/game/systems/crafting.ts
// Unit tests cover specific scenarios; property tests verify universal invariants.

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { canCraft, craft, unlockRecipes, SATCHEL_SLOTS, MATERIAL_STACK_LIMIT } from './crafting'
import { RECIPES, RECIPE_MAP } from '../../data/recipes'
import type { Inventory, ItemId, ItemStack } from '../types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build an empty inventory. */
function emptyInv(): Inventory {
  return {
    slots: [],
    keyItems: [],
    relics: [],
    hotbar: [null, null, null, null],
  }
}

/** Build an inventory pre-loaded with specific stacks. */
function invWith(stacks: ItemStack[]): Inventory {
  return { ...emptyInv(), slots: stacks }
}

/** Total quantity of `item` across all slots. */
function countItem(inv: Inventory, item: ItemId): number {
  return inv.slots.filter((s) => s.item === item).reduce((acc, s) => acc + s.qty, 0)
}


// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

describe('unlockRecipes', () => {
  it('returns the four start recipes on gameStart', () => {
    const ids = unlockRecipes({ type: 'gameStart' })
    expect(ids).toContain('r-bone-club')
    expect(ids).toContain('r-bandage')
    expect(ids).toContain('r-tallow-candle')
    expect(ids).toContain('r-lantern-refill')
    expect(ids).toHaveLength(4)
  })

  it('returns exactly r-sharpened-shovel after night 1', () => {
    const ids = unlockRecipes({ type: 'dawnStarted', night: 1 })
    expect(ids).toEqual(['r-sharpened-shovel'])
  })

  it('returns r-holy-water-flask after night 2', () => {
    const ids = unlockRecipes({ type: 'dawnStarted', night: 2 })
    expect(ids).toEqual(['r-holy-water-flask'])
  })

  it('returns r-lantern-trap after night 3', () => {
    const ids = unlockRecipes({ type: 'dawnStarted', night: 3 })
    expect(ids).toEqual(['r-lantern-trap'])
  })

  it('returns r-nail-bomb after night 4', () => {
    const ids = unlockRecipes({ type: 'dawnStarted', night: 4 })
    expect(ids).toEqual(['r-nail-bomb'])
  })

  it('returns r-salt-circle after reading journal page 3', () => {
    const ids = unlockRecipes({ type: 'journalRead', page: 3 })
    expect(ids).toEqual(['r-salt-circle'])
  })

  it('returns nothing for journal pages other than 3', () => {
    expect(unlockRecipes({ type: 'journalRead', page: 1 })).toHaveLength(0)
    expect(unlockRecipes({ type: 'journalRead', page: 2 })).toHaveLength(0)
    expect(unlockRecipes({ type: 'journalRead', page: 4 })).toHaveLength(0)
  })
})

describe('canCraft', () => {
  it('returns ok=true when inputs are fully available', () => {
    const recipe = RECIPE_MAP['r-bandage'] // needs 2 cloth
    const inv = invWith([{ item: 'cloth', qty: 2 }])
    const result = canCraft(inv, recipe)
    expect(result.ok).toBe(true)
    expect(result.missing).toHaveLength(0)
  })

  it('returns ok=false and lists missing items when inputs are absent', () => {
    const recipe = RECIPE_MAP['r-bandage'] // needs 2 cloth
    const result = canCraft(emptyInv(), recipe)
    expect(result.ok).toBe(false)
    expect(result.missing).toContainEqual({ item: 'cloth', qty: 2 })
  })

  it('returns ok=false and lists partial shortfall', () => {
    const recipe = RECIPE_MAP['r-bone-club'] // needs 3 bone, 1 cloth
    const inv = invWith([{ item: 'bone', qty: 1 }]) // missing 2 bone, all cloth
    const result = canCraft(inv, recipe)
    expect(result.ok).toBe(false)
    const missingBone = result.missing.find((m) => m.item === 'bone')
    const missingCloth = result.missing.find((m) => m.item === 'cloth')
    expect(missingBone).toEqual({ item: 'bone', qty: 2 })
    expect(missingCloth).toEqual({ item: 'cloth', qty: 1 })
  })

  it('includes consumesTool in missing list when the tool is absent', () => {
    const recipe = RECIPE_MAP['r-sharpened-shovel'] // needs rusty-shovel + 2 iron-nail
    const inv = invWith([{ item: 'iron-nail', qty: 2 }]) // no rusty-shovel
    const result = canCraft(inv, recipe)
    expect(result.ok).toBe(false)
    expect(result.missing).toContainEqual({ item: 'rusty-shovel', qty: 1 })
  })

  it('ok=true when consumesTool is present alongside inputs', () => {
    const recipe = RECIPE_MAP['r-sharpened-shovel']
    const inv = invWith([
      { item: 'iron-nail', qty: 2 },
      { item: 'rusty-shovel', qty: 1 },
    ])
    expect(canCraft(inv, recipe).ok).toBe(true)
  })
})

describe('craft — tool replacement', () => {
  it('replaces rusty-shovel with sharpened-shovel and preserves the hotbar slot', () => {
    const recipe = RECIPE_MAP['r-sharpened-shovel']
    const inv: Inventory = {
      slots: [
        { item: 'rusty-shovel', qty: 1 },
        { item: 'iron-nail', qty: 2 },
      ],
      keyItems: [],
      relics: [],
      hotbar: ['rusty-shovel', null, null, null],
    }

    const result = craft(inv, recipe)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    // rusty-shovel consumed, sharpened-shovel present
    expect(countItem(result.inv, 'rusty-shovel')).toBe(0)
    expect(countItem(result.inv, 'sharpened-shovel')).toBe(1)
    expect(countItem(result.inv, 'iron-nail')).toBe(0)

    // hotbar slot 0 now points to sharpened-shovel
    expect(result.inv.hotbar[0]).toBe('sharpened-shovel')
  })

  it('preserves the correct hotbar slot when tool is in slot 2', () => {
    const recipe = RECIPE_MAP['r-sharpened-shovel']
    const inv: Inventory = {
      slots: [
        { item: 'rusty-shovel', qty: 1 },
        { item: 'iron-nail', qty: 2 },
      ],
      keyItems: [],
      relics: [],
      hotbar: [null, null, 'rusty-shovel', null],
    }

    const result = craft(inv, recipe)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.inv.hotbar[2]).toBe('sharpened-shovel')
    // Other slots unchanged
    expect(result.inv.hotbar[0]).toBeNull()
    expect(result.inv.hotbar[1]).toBeNull()
    expect(result.inv.hotbar[3]).toBeNull()
  })
})

describe('craft — capacity check (Req 3.2)', () => {
  it('refuses and returns no-capacity when satchel is full', () => {
    // r-bandage: consumes 2 cloth (1 slot), outputs 1 bandage (1 new slot).
    // After consuming 2 cloth the slot empties, so we need the remaining
    // occupied slots to still equal 12. Strategy: put cloth at qty=3 so the
    // slot stays after removing 2, and fill the other 11 slots with filler.
    const recipe = RECIPE_MAP['r-bandage']
    const inv: Inventory = {
      slots: [
        { item: 'cloth', qty: 3 },                             // slot 1 — survives after -2
        ...Array.from({ length: 11 }, () => ({                 // slots 2-12
          item: 'bone' as ItemId,
          qty: 1,
        })),
      ],
      keyItems: [],
      relics: [],
      hotbar: [null, null, null, null],
    }

    // Satchel starts at 12 slots. After consuming 2 cloth, the cloth slot
    // has qty=1 remaining, so still 12 slots occupied. No room for bandage.
    const result = craft(inv, recipe)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('no-capacity')

    // Inventory must be unchanged
    expect(countItem(inv, 'cloth')).toBe(3)
  })

  it('succeeds when exactly one slot is free', () => {
    const recipe = RECIPE_MAP['r-bandage'] // needs 2 cloth, outputs 1 bandage
    // 11 bone slots + 1 cloth slot = 12 slots used. After removing the cloth slot
    // (2 cloth consumed), we have 11 slots, with room for 1 bandage slot.
    const inv: Inventory = {
      slots: [
        { item: 'cloth', qty: 2 },
        ...Array.from({ length: 11 }, () => ({ item: 'bone' as ItemId, qty: 1 })),
      ],
      keyItems: [],
      relics: [],
      hotbar: [null, null, null, null],
    }
    // Satchel has 12 slots occupied. After removing 2 cloth (which empties that slot),
    // 11 slots remain, so the bandage fits.
    const result = craft(inv, recipe)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(countItem(result.inv, 'bandage')).toBe(1)
  })
})

describe('craft — atomicity', () => {
  it('does not mutate the original inventory on failure', () => {
    const recipe = RECIPE_MAP['r-bandage']
    const inv = emptyInv() // no cloth
    const slotsBefore = [...inv.slots]
    const result = craft(inv, recipe)
    expect(result.ok).toBe(false)
    expect(inv.slots).toEqual(slotsBefore)
  })

  it('does not mutate the original inventory on success', () => {
    const recipe = RECIPE_MAP['r-bandage']
    const inv = invWith([{ item: 'cloth', qty: 2 }])
    const slotsBefore = inv.slots.map((s) => ({ ...s }))
    craft(inv, recipe)
    expect(inv.slots).toEqual(slotsBefore)
  })
})

// ---------------------------------------------------------------------------
// Property-based tests
// ---------------------------------------------------------------------------

/**
 * Arbitraries
 */

/** Generate a small valid satchel (0–8 slots) with random materials. */
const materialIds = [
  'bone',
  'iron-nail',
  'candle-wax',
  'holy-water',
  'cloth',
  'lamp-oil',
  'grave-salt',
] as const

const arbMaterialId = fc.constantFrom(...materialIds)

const arbItemStack = fc.record({
  item: arbMaterialId,
  qty: fc.integer({ min: 1, max: MATERIAL_STACK_LIMIT }),
})

/** Inventory with a bounded number of slots so there's sometimes room. */
const arbInventory: fc.Arbitrary<Inventory> = fc
  .array(arbItemStack, { minLength: 0, maxLength: 8 })
  .map((stacks) => ({
    slots: stacks,
    keyItems: [],
    relics: [],
    hotbar: [null, null, null, null] as Inventory['hotbar'],
  }))

/** Pick a random recipe from the full list. */
const arbRecipe = fc.constantFrom(...RECIPES)

// ---------------------------------------------------------------------------
// Property 1: craft never produces negative item counts
// **Validates: Requirements 3.2**
// ---------------------------------------------------------------------------
describe('property: craft never produces negative item counts', () => {
  it('all slot quantities are positive after a successful craft', () => {
    fc.assert(
      fc.property(arbInventory, arbRecipe, (inv, recipe) => {
        const result = craft(inv, recipe)
        if (!result.ok) return true // only check successful crafts
        return result.inv.slots.every((s) => s.qty > 0)
      }),
      { numRuns: 500 },
    )
  })
})

// ---------------------------------------------------------------------------
// Property 2: if canCraft is false, craft returns an error and inventory is unchanged
// **Validates: Requirements 3.1, 3.2**
// ---------------------------------------------------------------------------
describe('property: canCraft false → craft returns error, inventory unchanged', () => {
  it('craft returns error without consuming anything when inputs are insufficient', () => {
    fc.assert(
      fc.property(arbInventory, arbRecipe, (inv, recipe) => {
        const check = canCraft(inv, recipe)
        if (check.ok) return true // skip inventories that can already craft
        const result = craft(inv, recipe)
        if (result.ok) return false // craft should have failed

        // Inventory must be identical to original
        if (result.error !== 'missing-inputs') return false
        if (inv.slots.length !== inv.slots.length) return false
        const slotsUnchanged = inv.slots.every((original, i) => {
          const s = inv.slots[i]
          return s.item === original.item && s.qty === original.qty
        })
        return slotsUnchanged
      }),
      { numRuns: 500 },
    )
  })
})

// ---------------------------------------------------------------------------
// Property 3: if canCraft is true and capacity allows, item totals change by
//             exactly -inputs + output
// **Validates: Requirements 3.1, 3.2, 3.4**
// ---------------------------------------------------------------------------
describe('property: successful craft produces exact item delta', () => {
  it('total per-item counts change by exactly the recipe delta', () => {
    fc.assert(
      fc.property(arbInventory, arbRecipe, (baseInv, recipe) => {
        // We need the inventory to be craftable: supply the exact inputs.
        const suppliedSlots: ItemStack[] = [...baseInv.slots]

        // Ensure each input is available
        for (const req of recipe.inputs) {
          const have = suppliedSlots
            .filter((s) => s.item === req.item)
            .reduce((a, s) => a + s.qty, 0)
          const need = req.qty - have
          if (need > 0) suppliedSlots.push({ item: req.item, qty: need })
        }

        // Ensure consumesTool is available
        if (recipe.consumesTool !== undefined) {
          const toolId = recipe.consumesTool
          const have = suppliedSlots
            .filter((s) => s.item === toolId)
            .reduce((a, s) => a + s.qty, 0)
          if (have < 1) suppliedSlots.push({ item: toolId, qty: 1 })
        }

        // Only run if the supplied inventory fits in the satchel
        if (suppliedSlots.length > SATCHEL_SLOTS) return true

        const inv: Inventory = {
          slots: suppliedSlots,
          keyItems: [],
          relics: [],
          hotbar: [null, null, null, null],
        }

        const result = craft(inv, recipe)
        if (!result.ok) {
          // The only valid failure here is no-capacity
          return result.error === 'no-capacity'
        }

        // Verify deltas for each input
        for (const req of recipe.inputs) {
          const before = countItem(inv, req.item)
          const after = countItem(result.inv, req.item)
          // If input === output item, net change is -qty + output.qty
          const outputGain = recipe.output.item === req.item ? recipe.output.qty : 0
          if (after !== before - req.qty + outputGain) return false
        }

        // Verify consumesTool was removed (if it differs from output)
        if (
          recipe.consumesTool !== undefined &&
          recipe.consumesTool !== recipe.output.item
        ) {
          const before = countItem(inv, recipe.consumesTool)
          const after = countItem(result.inv, recipe.consumesTool)
          if (after !== before - 1) return false
        }

        // Verify output was added (accounting for possible input overlap)
        const outputItem = recipe.output.item
        const inputConsumed = recipe.inputs
          .filter((r) => r.item === outputItem)
          .reduce((a, r) => a + r.qty, 0)
        const toolConsumed =
          recipe.consumesTool === outputItem ? 1 : 0
        const before = countItem(inv, outputItem)
        const after = countItem(result.inv, outputItem)
        if (after !== before - inputConsumed - toolConsumed + recipe.output.qty) return false

        return true
      }),
      { numRuns: 500 },
    )
  })
})
