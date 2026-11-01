// Checkpoint integration tests — spec 03-crafting-inventory, Task 9.
//
// Exercises the full spec end-to-end using pure game-logic functions only.
// Three concrete scenarios are verified:
//   A. Craft a bone club from scratch
//   B. Sharpen the shovel after night 1
//   C. Repair chapel stage 1 (bar the door)

import { describe, it, expect } from 'vitest'
import { craft, unlockRecipes } from '../src/game/systems/crafting'
import { repair, isDoorBarred } from '../src/game/systems/repairs'
import { RECIPE_MAP } from '../src/data/recipes'
import type { Inventory } from '../src/game/types'
import type { ChapelState } from '../src/game/systems/repairs'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInventory(overrides: Partial<Inventory> = {}): Inventory {
  return {
    slots: [],
    keyItems: [],
    relics: [],
    hotbar: [null, null, null, null],
    ...overrides,
  }
}

function freshChapel(): ChapelState {
  return { completedStages: [], altarHealedToday: false, finalRiteActive: false }
}

// ---------------------------------------------------------------------------
// Scenario A: Craft a bone club
// ---------------------------------------------------------------------------

describe('Scenario A: Craft a bone club', () => {
  it('unlockRecipes gameStart includes r-bone-club', () => {
    const unlocked = unlockRecipes({ type: 'gameStart' })
    expect(unlocked).toContain('r-bone-club')
  })

  it('craft returns ok:true with 3 bone + 1 cloth in inventory', () => {
    const inv = makeInventory({
      slots: [
        { item: 'bone', qty: 3 },
        { item: 'cloth', qty: 1 },
        { item: 'rusty-shovel', qty: 1 },
      ],
      hotbar: ['rusty-shovel', null, null, null],
    })

    const result = craft(inv, RECIPE_MAP['r-bone-club'])
    expect(result.ok).toBe(true)
  })

  it('output inventory has bone-club and consumed all 3 bone and 1 cloth', () => {
    const inv = makeInventory({
      slots: [
        { item: 'bone', qty: 3 },
        { item: 'cloth', qty: 1 },
        { item: 'rusty-shovel', qty: 1 },
      ],
      hotbar: ['rusty-shovel', null, null, null],
    })

    const result = craft(inv, RECIPE_MAP['r-bone-club'])
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const boneCount = result.inv.slots
      .filter((s) => s.item === 'bone')
      .reduce((a, s) => a + s.qty, 0)
    const clothCount = result.inv.slots
      .filter((s) => s.item === 'cloth')
      .reduce((a, s) => a + s.qty, 0)
    const clubCount = result.inv.slots
      .filter((s) => s.item === 'bone-club')
      .reduce((a, s) => a + s.qty, 0)

    expect(boneCount).toBe(0)
    expect(clothCount).toBe(0)
    expect(clubCount).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Scenario B: Sharpen the shovel after night 1
// ---------------------------------------------------------------------------

describe('Scenario B: Sharpen the shovel after night 1', () => {
  it('unlockRecipes dawnStarted night:1 includes r-sharpened-shovel', () => {
    const unlocked = unlockRecipes({ type: 'dawnStarted', night: 1 })
    expect(unlocked).toContain('r-sharpened-shovel')
  })

  it('craft returns ok:true with rusty-shovel + 2 iron-nail', () => {
    const inv = makeInventory({
      slots: [
        { item: 'rusty-shovel', qty: 1 },
        { item: 'iron-nail', qty: 2 },
      ],
      hotbar: ['rusty-shovel', null, null, null],
    })

    const result = craft(inv, RECIPE_MAP['r-sharpened-shovel'])
    expect(result.ok).toBe(true)
  })

  it('rusty-shovel is removed and sharpened-shovel is added', () => {
    const inv = makeInventory({
      slots: [
        { item: 'rusty-shovel', qty: 1 },
        { item: 'iron-nail', qty: 2 },
      ],
      hotbar: ['rusty-shovel', null, null, null],
    })

    const result = craft(inv, RECIPE_MAP['r-sharpened-shovel'])
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const rustyCount = result.inv.slots
      .filter((s) => s.item === 'rusty-shovel')
      .reduce((a, s) => a + s.qty, 0)
    const sharpenedCount = result.inv.slots
      .filter((s) => s.item === 'sharpened-shovel')
      .reduce((a, s) => a + s.qty, 0)
    const nailCount = result.inv.slots
      .filter((s) => s.item === 'iron-nail')
      .reduce((a, s) => a + s.qty, 0)

    expect(rustyCount).toBe(0)
    expect(sharpenedCount).toBe(1)
    expect(nailCount).toBe(0)
  })

  it('hotbar slot 0 is updated from rusty-shovel to sharpened-shovel', () => {
    const inv = makeInventory({
      slots: [
        { item: 'rusty-shovel', qty: 1 },
        { item: 'iron-nail', qty: 2 },
      ],
      hotbar: ['rusty-shovel', null, null, null],
    })

    const result = craft(inv, RECIPE_MAP['r-sharpened-shovel'])
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.inv.hotbar[0]).toBe('sharpened-shovel')
    expect(result.inv.hotbar[1]).toBeNull()
    expect(result.inv.hotbar[2]).toBeNull()
    expect(result.inv.hotbar[3]).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Scenario C: Repair chapel stage 1 (bar the door)
// ---------------------------------------------------------------------------

describe('Scenario C: Chapel repair stage 1 — bar the door', () => {
  it('repair returns ok:true with 4 iron-nail + 2 bone', () => {
    const inv = makeInventory({
      slots: [
        { item: 'iron-nail', qty: 4 },
        { item: 'bone', qty: 2 },
      ],
    })

    const result = repair(inv, freshChapel())
    expect(result.ok).toBe(true)
  })

  it("completedStages contains 'barDoor' after repair", () => {
    const inv = makeInventory({
      slots: [
        { item: 'iron-nail', qty: 4 },
        { item: 'bone', qty: 2 },
      ],
    })

    const result = repair(inv, freshChapel())
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.chapel.completedStages).toContain('barDoor')
    expect(result.chapel.completedStages).toHaveLength(1)
  })

  it('isDoorBarred returns true for the resulting chapel state', () => {
    const inv = makeInventory({
      slots: [
        { item: 'iron-nail', qty: 4 },
        { item: 'bone', qty: 2 },
      ],
    })

    const result = repair(inv, freshChapel())
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(isDoorBarred(result.chapel)).toBe(true)
  })

  it('materials are consumed: 0 iron-nail and 0 bone remain', () => {
    const inv = makeInventory({
      slots: [
        { item: 'iron-nail', qty: 4 },
        { item: 'bone', qty: 2 },
      ],
    })

    const result = repair(inv, freshChapel())
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const nailCount = result.inv.slots
      .filter((s) => s.item === 'iron-nail')
      .reduce((a, s) => a + s.qty, 0)
    const boneCount = result.inv.slots
      .filter((s) => s.item === 'bone')
      .reduce((a, s) => a + s.qty, 0)

    expect(nailCount).toBe(0)
    expect(boneCount).toBe(0)
  })

  it('finalRiteActive: false keeps isDoorBarred as true', () => {
    const inv = makeInventory({
      slots: [
        { item: 'iron-nail', qty: 4 },
        { item: 'bone', qty: 2 },
      ],
    })

    const result = repair(inv, freshChapel())
    expect(result.ok).toBe(true)
    if (!result.ok) return

    // Rite not active → door should be barred
    expect(result.chapel.finalRiteActive).toBe(false)
    expect(isDoorBarred(result.chapel)).toBe(true)
  })
})
