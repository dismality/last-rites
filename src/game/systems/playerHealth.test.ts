import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { blockMoveMultiplier, damagePlayer, isDead, isLowHealth } from './playerHealth'

describe('playerHealth', () => {
  it('blocking removes 60% of damage', () => {
    expect(damagePlayer(100, 20, true).dealt).toBeCloseTo(8)
    expect(damagePlayer(100, 20, false).dealt).toBe(20)
  })

  it('reports death exactly once, at 0 HP', () => {
    const hit = damagePlayer(10, 10, false)
    expect(hit.health).toBe(0)
    expect(hit.died).toBe(true)
    expect(isDead(hit.health)).toBe(true)
    expect(damagePlayer(0, 10, false).died).toBe(false)
  })

  it('blocking halves movement; low health is below 30', () => {
    expect(blockMoveMultiplier(true)).toBe(0.5)
    expect(blockMoveMultiplier(false)).toBe(1)
    expect(isLowHealth(29)).toBe(true)
    expect(isLowHealth(30)).toBe(false)
  })

  it('property: blocked damage <= unblocked, HP never below 0 or raised', () => {
    // Validates: Requirements 2.4, 6.1
    fc.assert(
      fc.property(fc.double({ min: 0, max: 100, noNaN: true }), fc.double({ min: 0, max: 500, noNaN: true }), (hp, dmg) => {
        const blocked = damagePlayer(hp, dmg, true)
        const open = damagePlayer(hp, dmg, false)
        expect(blocked.dealt).toBeLessThanOrEqual(open.dealt)
        expect(blocked.health).toBeGreaterThanOrEqual(0)
        expect(open.health).toBeGreaterThanOrEqual(0)
        expect(open.health).toBeLessThanOrEqual(hp)
      }),
    )
  })
})
