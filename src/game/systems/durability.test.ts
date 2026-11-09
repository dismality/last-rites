// Tests for src/game/systems/durability.ts
// Unit tests cover specific scenarios; property tests verify universal invariants.

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { applyHit, createWeaponState, isCracked, spendSwing, maxDurability } from './durability'
import type { WeaponState } from './durability'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function boneClub(durability: number): WeaponState {
  return { id: 'bone-club', durability }
}

function sharpenedShovel(durability: number): WeaponState {
  return { id: 'sharpened-shovel', durability }
}

function rustyShovel(): WeaponState {
  return { id: 'rusty-shovel', durability: null }
}

// ---------------------------------------------------------------------------
// Unit tests — applyHit
// ---------------------------------------------------------------------------

describe('applyHit', () => {
  it('reduces bone-club durability by 1 on each hit', () => {
    const result = applyHit(boneClub(10))
    expect(result.weaponState.durability).toBe(9)
    expect(result.broke).toBe(false)
  })

  it('does not reduce durability below 0', () => {
    const result = applyHit(boneClub(0))
    expect(result.weaponState.durability).toBe(0)
    expect(result.broke).toBe(false)
  })

  it('sets broke=true exactly when durability transitions from 1 to 0', () => {
    const result = applyHit(boneClub(1))
    expect(result.weaponState.durability).toBe(0)
    expect(result.broke).toBe(true)
  })

  it('does not set broke=true when durability is already 0', () => {
    const result = applyHit(boneClub(0))
    expect(result.broke).toBe(false)
  })

  it('returns unchanged state for infinite-durability weapon', () => {
    const state = rustyShovel()
    const result = applyHit(state)
    expect(result.weaponState.durability).toBeNull()
    expect(result.broke).toBe(false)
    // Same reference (no clone needed, but at minimum same values)
    expect(result.weaponState.id).toBe('rusty-shovel')
  })

  it('does not mutate the input state', () => {
    const state = boneClub(5)
    applyHit(state)
    expect(state.durability).toBe(5)
  })
})

// ---------------------------------------------------------------------------
// Unit tests — createWeaponState
// ---------------------------------------------------------------------------

describe('createWeaponState', () => {
  it('creates bone-club with durability 30', () => {
    const ws = createWeaponState('bone-club')
    expect(ws.id).toBe('bone-club')
    expect(ws.durability).toBe(30)
  })

  it('creates sharpened-shovel with durability 50', () => {
    const ws = createWeaponState('sharpened-shovel')
    expect(ws.id).toBe('sharpened-shovel')
    expect(ws.durability).toBe(50)
  })

  it('creates rusty-shovel with null (infinite) durability', () => {
    const ws = createWeaponState('rusty-shovel')
    expect(ws.durability).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Unit tests — isCracked
// ---------------------------------------------------------------------------

describe('isCracked', () => {
  it('returns false when durability is above 20%', () => {
    // bone-club max 30; 20% threshold = 6; 7 hits remaining = not cracked
    expect(isCracked(boneClub(7))).toBe(false)
  })

  it('returns true when durability is below 20%', () => {
    // bone-club max 30; 5 remaining = 16.7% → cracked
    expect(isCracked(boneClub(5))).toBe(true)
  })

  it('returns true at exactly the last hit before 20% boundary', () => {
    // bone-club max 30; 6 / 30 = 20% exactly → NOT cracked (strictly <)
    expect(isCracked(boneClub(6))).toBe(false)
    // 5 / 30 = 16.7% → cracked
    expect(isCracked(boneClub(5))).toBe(true)
  })

  it('returns false for infinite-durability weapons', () => {
    expect(isCracked(rustyShovel())).toBe(false)
  })

  it('returns true for sharpened-shovel under 20% (threshold = 10)', () => {
    expect(isCracked(sharpenedShovel(9))).toBe(true)
    expect(isCracked(sharpenedShovel(10))).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Spec 07: spendSwing and upgrade-aware maxima
// ---------------------------------------------------------------------------

describe('spendSwing', () => {
  it('spends 1 for a hitting swing and none for a miss', () => {
    expect(spendSwing(boneClub(10), 3).weaponState.durability).toBe(9)
    expect(spendSwing(boneClub(10), 0).weaponState.durability).toBe(10)
  })

  it('never spends on the sabre', () => {
    const sabre: WeaponState = { id: 'silver-sabre', durability: null }
    expect(spendSwing(sabre, 5).weaponState.durability).toBeNull()
  })

  it('breaks the axe at 0', () => {
    const r = spendSwing({ id: 'wood-axe', durability: 1 }, 2)
    expect(r.broke).toBe(true)
    expect(r.weaponState.durability).toBe(0)
  })
})

describe('maxDurability', () => {
  it('uses base values and honours Iron-Banded Haft', () => {
    expect(maxDurability('wood-axe')).toBe(60)
    expect(maxDurability('wood-axe', ['up-axe-haft'])).toBe(100)
    expect(maxDurability('silver-sabre', ['up-axe-haft'])).toBeNull()
    expect(createWeaponState('wood-axe', ['up-axe-haft']).durability).toBe(100)
  })
})

// Feature: 07-combat-and-enemies, Property 17: Durability is spent once per swing that hits
// **Validates: Requirements 8.10, 8.11**
describe('property: durability is spent once per swing that hits', () => {
  it('loses exactly 1 on a hit, none on a miss, never below 0, sabre none', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 30 }),
        (durability, hits) => {
          const axe: WeaponState = { id: 'wood-axe', durability }
          const r = spendSwing(axe, hits)
          const expected = hits > 0 ? Math.max(durability - 1, 0) : durability
          expect(r.weaponState.durability).toBe(expected)
          expect(r.broke).toBe(hits > 0 && durability === 1)
          const sabre = spendSwing({ id: 'silver-sabre', durability: null }, hits)
          expect(sabre.weaponState.durability).toBeNull()
          expect(sabre.broke).toBe(false)
        },
      ),
      { numRuns: 300 },
    )
  })
})

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

/** Arbitrary finite weapon state (bone-club or sharpened-shovel). */
const arbFiniteWeaponState: fc.Arbitrary<WeaponState> = fc.oneof(
  fc.integer({ min: 0, max: 30 }).map((d) => boneClub(d)),
  fc.integer({ min: 0, max: 50 }).map((d) => sharpenedShovel(d)),
)

// ---------------------------------------------------------------------------
// Property 1: durability never goes below 0
// **Validates: Requirements 5.1**
// ---------------------------------------------------------------------------
describe('property: durability never goes below 0', () => {
  it('after any number of hits, durability is always >= 0', () => {
    fc.assert(
      fc.property(
        arbFiniteWeaponState,
        fc.integer({ min: 1, max: 100 }),
        (initial, hits) => {
          let state = initial
          for (let i = 0; i < hits; i++) {
            const result = applyHit(state)
            state = result.weaponState
          }
          // durability must never go negative
          return state.durability !== null && state.durability >= 0
        },
      ),
      { numRuns: 500 },
    )
  })
})

// ---------------------------------------------------------------------------
// Property 2: a weapon breaks exactly once — the broke flag fires precisely
//             when durability crosses from 1 to 0.
// **Validates: Requirements 5.2**
// ---------------------------------------------------------------------------
describe('property: broke fires exactly once, at 0 transition', () => {
  it('broke is true exactly once across the full hit sequence', () => {
    fc.assert(
      fc.property(
        // Start at a positive durability so there is eventually a break.
        fc.oneof(
          fc.integer({ min: 1, max: 30 }).map((d) => boneClub(d)),
          fc.integer({ min: 1, max: 50 }).map((d) => sharpenedShovel(d)),
        ),
        (initial) => {
          let state = initial
          // Hit until long past the break point.
          const maxHits = (initial.durability as number) + 10
          let brokeCount = 0

          for (let i = 0; i < maxHits; i++) {
            const result = applyHit(state)
            if (result.broke) brokeCount++
            state = result.weaponState
          }

          // Broke must happen exactly once.
          return brokeCount === 1
        },
      ),
      { numRuns: 300 },
    )
  })

  it('broke corresponds to the exact hit that reaches 0', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer({ min: 1, max: 30 }).map((d) => boneClub(d)),
          fc.integer({ min: 1, max: 50 }).map((d) => sharpenedShovel(d)),
        ),
        (initial) => {
          let state = initial
          const maxHits = (initial.durability as number) + 5

          for (let i = 0; i < maxHits; i++) {
            const result = applyHit(state)
            if (result.broke) {
              // When broke fires, durability must be exactly 0.
              return result.weaponState.durability === 0
            }
            state = result.weaponState
          }

          // We ran past max hits without breaking — shouldn't happen if
          // initial.durability > 0, but if so we've verified the invariant.
          return true
        },
      ),
      { numRuns: 300 },
    )
  })
})

// ---------------------------------------------------------------------------
// Property 3: infinite-durability weapons never break
// **Validates: Requirements 5.1**
// ---------------------------------------------------------------------------
describe('property: infinite-durability weapons never set broke', () => {
  it('rusty-shovel never breaks across arbitrary hit counts', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 200 }), (hits) => {
        let state = rustyShovel()
        for (let i = 0; i < hits; i++) {
          const result = applyHit(state)
          if (result.broke) return false
          state = result.weaponState
        }
        return true
      }),
      { numRuns: 200 },
    )
  })
})
