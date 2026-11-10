import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { LANTERN_MAX_FUEL, RETRY_MIN_FUEL } from '../../data/balance'
import { retryLoadout } from './retryLoadout'

describe('retryLoadout', () => {
  it('never starts below the minimum oil, keeps more, and caps at the tank (property)', () => {
    fc.assert(
      fc.property(fc.anything(), fc.integer({ min: 1, max: 400 }), (fuel, maxHealth) => {
        const r = retryLoadout(fuel, maxHealth)
        expect(r.fuel).toBeGreaterThanOrEqual(RETRY_MIN_FUEL)
        expect(r.fuel).toBeLessThanOrEqual(LANTERN_MAX_FUEL)
        expect(r.health).toBe(maxHealth)
        if (typeof fuel === 'number' && fuel >= RETRY_MIN_FUEL && fuel <= LANTERN_MAX_FUEL) {
          expect(r.fuel).toBe(fuel)
        }
      }),
    )
  })

  it('matches the playtest case: 39% oil comes back as 60%', () => {
    expect(retryLoadout(39, 100)).toEqual({ fuel: 60, health: 100 })
  })
})
