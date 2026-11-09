import { describe, expect, it } from 'vitest'
import * as fc from 'fast-check'
import { DODGE } from '../../data/combatMoves'
import { canDodge, dodgeVelocity, isInvulnerable, startDodge, tickDodge } from './dodge'
import { spendStamina } from './stamina'

describe('dodge', () => {
  it('is gated by stamina, cooldown and an active dash', () => {
    expect(canDodge(25, 0, false)).toBe(true)
    expect(canDodge(24.9, 0, false)).toBe(false)
    expect(canDodge(100, 0.3, false)).toBe(false)
    expect(canDodge(100, 0, true)).toBe(false)
  })
  it('dashes the move direction, or backwards with no input', () => {
    expect(startDodge({ x: 3, z: 0 }, { x: 0, z: -1 }).dir).toEqual({ x: 1, z: 0 })
    expect(startDodge({ x: 0, z: 0 }, { x: 0, z: -1 }).dir).toEqual({ x: 0, z: 1 })
  })
  it('moves 3 m over 0.25 s', () => {
    let s = startDodge({ x: 1, z: 0 }, { x: 0, z: -1 })
    const v = dodgeVelocity(s)
    expect(v.x).toBeCloseTo(12)
    let t = 0
    let dist = 0
    for (let n = 0; n < 100 && s; n++) {
      dist += dodgeVelocity(s).x / 60
      const next = tickDodge(s, 1 / 60)
      t += 1 / 60
      if (!next) break
      s = next
    }
    expect(t).toBeCloseTo(DODGE.durationS, 1)
    expect(dist).toBeCloseTo(DODGE.distanceM, 0)
  })
  it('is invulnerable for the first 0.2 s only', () => {
    const s = startDodge({ x: 1, z: 0 }, { x: 0, z: -1 })
    expect(isInvulnerable(s)).toBe(true)
    expect(isInvulnerable({ ...s, elapsedS: 0.199 })).toBe(true)
    expect(isInvulnerable({ ...s, elapsedS: 0.2 })).toBe(false)
    expect(isInvulnerable(null)).toBe(false)
  })
  it('ends at 0.25 s', () => {
    const s = startDodge({ x: 1, z: 0 }, { x: 0, z: -1 })
    expect(tickDodge(s, 0.24)).not.toBeNull()
    expect(tickDodge(s, 0.25)).toBeNull()
  })
})

// Feature: 07-combat-and-enemies, Property 18: Kick and Dodge are gated, bounded and invulnerable only at the start
describe('Property 18 (dodge)', () => {
  it('acts iff allowed, spends exactly 25, stays in 0..100', () => {
    // **Validates: Requirements 9.4, 9.7, 9.10, 17.9**
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 100, noNaN: true }),
        fc.double({ min: 0, max: 2, noNaN: true }),
        fc.boolean(),
        (stamina, cd, active) => {
          const s = { stamina, regenDelayTimer: 0 }
          const ok = canDodge(stamina, cd, active)
          expect(ok).toBe(stamina >= DODGE.staminaCost && cd <= 0 && !active)
          const r = ok ? spendStamina(s, DODGE.staminaCost) : { state: s, ok: false }
          expect(r.state.stamina).toBeGreaterThanOrEqual(0)
          expect(r.state.stamina).toBeLessThanOrEqual(100)
          if (ok) expect(r.state.stamina).toBeCloseTo(stamina - DODGE.staminaCost, 9)
          else expect(r.state).toBe(s)
        },
      ),
    )
  })
  it('is invulnerable iff elapsed < 0.2 s and ends by 0.25 s', () => {
    // **Validates: Requirements 9.5, 9.6**
    fc.assert(
      fc.property(fc.double({ min: 0, max: 0.4, noNaN: true }), (t) => {
        const s = { elapsedS: 0, dir: { x: 1, z: 0 } }
        const next = tickDodge(s, t)
        expect(next === null).toBe(t >= DODGE.durationS)
        if (next) expect(isInvulnerable(next)).toBe(next.elapsedS < DODGE.iFramesS)
      }),
    )
  })
})
