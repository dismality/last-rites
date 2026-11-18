import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { clampScriptedDamage, guardedDamage } from './hurtGuard'

describe('clampScriptedDamage', () => {
  it('never leaves the player under 1 HP after an event that began above 1', () => {
    // Feature: 11-horror-pass, Property 5: Screen scare never reduces health (creature clamp part)
    // **Validates: Requirements 2.20**
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 100 }),
        fc.integer({ min: 1, max: 100 }),
        fc.double({ min: 0, max: 1000, noNaN: true }),
        (start, hp, dmg) => {
          const after = clampScriptedDamage(hp, start, dmg)
          expect(after).toBeGreaterThanOrEqual(1)
          expect(after).toBeLessThanOrEqual(hp)
          expect(guardedDamage(hp, start, dmg)).toBeCloseTo(hp - after)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('applies damage normally when the event began at 1 HP or less', () => {
    expect(clampScriptedDamage(1, 1, 8)).toBe(0)
    expect(clampScriptedDamage(5, 0, 8)).toBe(0)
    expect(clampScriptedDamage(50, 50, 8)).toBe(42)
  })

  it('ignores negative and non-finite damage', () => {
    expect(clampScriptedDamage(10, 10, -5)).toBe(10)
    expect(clampScriptedDamage(10, 10, Number.NaN)).toBe(10)
  })
})
