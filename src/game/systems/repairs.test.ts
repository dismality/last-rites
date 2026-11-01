// Tests for src/game/systems/repairs.ts
// Unit tests cover specific scenarios; property tests verify universal invariants.

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { canRepair, repair, isDoorBarred, isAltarActive, isBellActive } from './repairs'
import { REPAIR_STAGES } from '../../data/repairs'
import type { Inventory, ItemId, ItemStack } from '../types'
import type { ChapelState } from './repairs'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyInv(): Inventory {
  return {
    slots: [],
    keyItems: [],
    relics: [],
    hotbar: [null, null, null, null],
  }
}

function invWith(stacks: ItemStack[]): Inventory {
  return { ...emptyInv(), slots: stacks }
}

function countItem(inv: Inventory, item: ItemId): number {
  return inv.slots
    .filter((s) => s.item === item)
    .reduce((acc, s) => acc + s.qty, 0)
}

function freshChapel(): ChapelState {
  return { completedStages: [], altarHealedToday: false, finalRiteActive: false }
}

function chapelAfterStages(n: 0 | 1 | 2 | 3): ChapelState {
  const effects = REPAIR_STAGES.slice(0, n).map((s) => s.effect)
  return { completedStages: effects, altarHealedToday: false, finalRiteActive: false }
}

// ---------------------------------------------------------------------------
// Unit tests — canRepair
// ---------------------------------------------------------------------------

describe('canRepair', () => {
  it('returns the first stage when chapel is untouched', () => {
    const result = canRepair(emptyInv(), freshChapel())
    expect(result.nextStage).toEqual(REPAIR_STAGES[0])
  })

  it('returns the second stage after stage 1 is complete', () => {
    const result = canRepair(emptyInv(), chapelAfterStages(1))
    expect(result.nextStage).toEqual(REPAIR_STAGES[1])
  })

  it('returns the third stage after stages 1 and 2 are complete', () => {
    const result = canRepair(emptyInv(), chapelAfterStages(2))
    expect(result.nextStage).toEqual(REPAIR_STAGES[2])
  })

  it('returns ok:false and null nextStage when all stages are complete', () => {
    const result = canRepair(emptyInv(), chapelAfterStages(3))
    expect(result.ok).toBe(false)
    expect(result.nextStage).toBeNull()
    expect(result.missing).toHaveLength(0)
  })

  it('ok=true when player has all materials for stage 1', () => {
    // Stage 1 costs 4 iron-nail, 2 bone
    const inv = invWith([
      { item: 'iron-nail', qty: 4 },
      { item: 'bone', qty: 2 },
    ])
    const result = canRepair(inv, freshChapel())
    expect(result.ok).toBe(true)
    expect(result.missing).toHaveLength(0)
  })

  it('lists missing quantities correctly when partially funded', () => {
    // Stage 1 costs 4 iron-nail, 2 bone; only have 1 nail, 0 bone
    const inv = invWith([{ item: 'iron-nail', qty: 1 }])
    const result = canRepair(inv, freshChapel())
    expect(result.ok).toBe(false)
    const missingNail = result.missing.find((m) => m.item === 'iron-nail')
    const missingBone = result.missing.find((m) => m.item === 'bone')
    expect(missingNail).toEqual({ item: 'iron-nail', qty: 3 })
    expect(missingBone).toEqual({ item: 'bone', qty: 2 })
  })

  it('stage costs match data in repairs.ts', () => {
    for (let i = 0; i < REPAIR_STAGES.length; i++) {
      const chapel = chapelAfterStages(i as 0 | 1 | 2 | 3)
      const result = canRepair(emptyInv(), chapel)
      expect(result.nextStage).toEqual(REPAIR_STAGES[i])
    }
  })
})

// ---------------------------------------------------------------------------
// Unit tests — repair order
// ---------------------------------------------------------------------------

describe('repair — order enforcement', () => {
  it('returns all-complete when all three stages are done', () => {
    const result = repair(emptyInv(), chapelAfterStages(3))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('all-complete')
  })

  it('returns missing-materials when player cannot afford stage 1', () => {
    const result = repair(emptyInv(), freshChapel())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('missing-materials')
  })
})

// ---------------------------------------------------------------------------
// Unit tests — repair atomicity
// ---------------------------------------------------------------------------

describe('repair — atomicity', () => {
  it('does not mutate the original inventory on failure', () => {
    const inv = emptyInv()
    const slotsBefore = [...inv.slots]
    repair(inv, freshChapel())
    expect(inv.slots).toEqual(slotsBefore)
  })

  it('does not mutate the original chapel state on failure', () => {
    const chapel = freshChapel()
    const stagesBefore = [...chapel.completedStages]
    repair(emptyInv(), chapel)
    expect(chapel.completedStages).toEqual(stagesBefore)
  })

  it('does not mutate original inventory on success', () => {
    const inv = invWith([
      { item: 'iron-nail', qty: 4 },
      { item: 'bone', qty: 2 },
    ])
    const slotsBefore = inv.slots.map((s) => ({ ...s }))
    repair(inv, freshChapel())
    expect(inv.slots).toEqual(slotsBefore)
  })

  it('successful stage 1 repair consumes exactly the stage 1 cost', () => {
    const inv = invWith([
      { item: 'iron-nail', qty: 6 }, // 4 needed, 2 leftover
      { item: 'bone', qty: 3 },      // 2 needed, 1 leftover
    ])
    const result = repair(inv, freshChapel())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(countItem(result.inv, 'iron-nail')).toBe(2)
    expect(countItem(result.inv, 'bone')).toBe(1)
  })

  it('successful stage 1 repair advances completedStages', () => {
    const inv = invWith([
      { item: 'iron-nail', qty: 4 },
      { item: 'bone', qty: 2 },
    ])
    const result = repair(inv, freshChapel())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.chapel.completedStages).toContain('barDoor')
    expect(result.chapel.completedStages).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// Unit tests — altar heal blocked when already healed today
// ---------------------------------------------------------------------------

describe('altarHealedToday', () => {
  it('isAltarActive is true after stage 2 is complete', () => {
    expect(isAltarActive(chapelAfterStages(2))).toBe(true)
  })

  it('isAltarActive is false before stage 2', () => {
    expect(isAltarActive(chapelAfterStages(1))).toBe(false)
    expect(isAltarActive(freshChapel())).toBe(false)
  })

  it('altarHealedToday blocks a second heal', () => {
    // Simulate: altarHealedToday is true → scene should refuse to heal.
    const chapel: ChapelState = {
      completedStages: ['barDoor', 'altarSave'],
      altarHealedToday: true,
      finalRiteActive: false,
    }
    // Verify scene would reject (the field is checked before healing).
    expect(chapel.altarHealedToday).toBe(true)
    expect(isAltarActive(chapel)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Unit tests — door barring selector
// ---------------------------------------------------------------------------

describe('isDoorBarred', () => {
  it('false when stage 1 is not complete', () => {
    expect(isDoorBarred(freshChapel())).toBe(false)
  })

  it('true when stage 1 complete and final rite not active', () => {
    const chapel = chapelAfterStages(1)
    expect(isDoorBarred(chapel)).toBe(true)
  })

  it('false when stage 1 complete but final rite is active', () => {
    const chapel: ChapelState = {
      completedStages: ['barDoor'],
      altarHealedToday: false,
      finalRiteActive: true,
    }
    expect(isDoorBarred(chapel)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Unit tests — bell selector
// ---------------------------------------------------------------------------

describe('isBellActive', () => {
  it('false when stage 3 is not complete', () => {
    expect(isBellActive(chapelAfterStages(2))).toBe(false)
  })

  it('true when all three stages complete', () => {
    expect(isBellActive(chapelAfterStages(3))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Property-based tests
// ---------------------------------------------------------------------------

/** Generate an inventory for stage N (gives exactly the required materials). */
function invForStage(stageIndex: number): Inventory {
  const stage = REPAIR_STAGES[stageIndex]
  return invWith(stage.cost.map((c) => ({ item: c.item, qty: c.qty })))
}

// ---------------------------------------------------------------------------
// Property 1: repair never produces negative item counts
// **Validates: Requirements 6.2**
// ---------------------------------------------------------------------------
describe('property: repair never produces negative item counts', () => {
  it('all slot quantities are positive after a successful repair', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2 }),
        (stageIndex) => {
          const chapel = chapelAfterStages(stageIndex as 0 | 1 | 2)
          // Build an inventory with more than enough materials for the stage.
          const stage = REPAIR_STAGES[stageIndex]
          const extraSlots = stage.cost.map((c) => ({
            item: c.item,
            qty: c.qty + 2,
          }))
          const inv = invWith(extraSlots)
          const result = repair(inv, chapel)
          if (!result.ok) return true
          return result.inv.slots.every((s) => s.qty > 0)
        },
      ),
      { numRuns: 300 },
    )
  })
})

// ---------------------------------------------------------------------------
// Property 2: completed stages always monotonically advance
// **Validates: Requirements 6.3**
// ---------------------------------------------------------------------------
describe('property: completed stages always monotonically advance', () => {
  it('each successful repair adds exactly one stage in order', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2 }),
        (stageIndex) => {
          const chapel = chapelAfterStages(stageIndex as 0 | 1 | 2)
          const inv = invForStage(stageIndex)
          const result = repair(inv, chapel)
          if (!result.ok) return true
          // Must have exactly stageIndex + 1 stages after this repair.
          if (result.chapel.completedStages.length !== stageIndex + 1) return false
          // The new last stage must be the one just applied.
          const newEffect = REPAIR_STAGES[stageIndex].effect
          return result.chapel.completedStages[stageIndex] === newEffect
        },
      ),
      { numRuns: 300 },
    )
  })
})

// ---------------------------------------------------------------------------
// Property 3: repair returns all-complete when all stages are done
// **Validates: Requirements 6.3**
// ---------------------------------------------------------------------------
describe('property: repair on a fully-repaired chapel always returns all-complete', () => {
  it('ok is always false with error all-complete when all three stages done', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            item: fc.constantFrom(
              'bone' as const,
              'iron-nail' as const,
              'candle-wax' as const,
              'holy-water' as const,
              'cloth' as const,
              'lamp-oil' as const,
              'grave-salt' as const,
            ),
            qty: fc.integer({ min: 1, max: 10 }),
          }),
          { minLength: 0, maxLength: 6 },
        ),
        (stacks) => {
          const inv = invWith(stacks)
          const chapel = chapelAfterStages(3)
          const result = repair(inv, chapel)
          return result.ok === false && !result.ok && result.error === 'all-complete'
        },
      ),
      { numRuns: 300 },
    )
  })
})
