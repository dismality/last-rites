import { describe, expect, it } from 'vitest'
import * as fc from 'fast-check'
import type { EnemyId } from '../../data/enemies'
import { KICK } from '../../data/combatMoves'
import { canKick, resolveKick } from './kick'
import { spendStamina } from './stamina'
import type { AIEnemy } from './enemyAI'

const ctx = { lanternFuel: 100 }
const origin = { x: 0, z: 0 }
const fwd = { x: 0, z: -1 }
const mk = (type: EnemyId, z: number, uid = 'a', hp = 100): AIEnemy =>
  ({ uid, type, hp, maxHp: hp, pos: { x: 0, z }, stagger: 0, knockdown: 0 }) as unknown as AIEnemy

describe('canKick', () => {
  it('needs 15 stamina and no cooldown', () => {
    expect(canKick(15, 0)).toBe(true)
    expect(canKick(14.9, 0)).toBe(false)
    expect(canKick(100, 0.1)).toBe(false)
  })
})

describe('resolveKick', () => {
  it('damages, pushes 2 m and staggers 0.6 s the nearest zombie', () => {
    const r = resolveKick(origin, fwd, [mk('shambler', -1.6, 'far'), mk('shambler', -1, 'near')], ctx)
    expect(r.targetUid).toBe('near')
    const near = r.enemies.find((e) => e.uid === 'near')!
    expect(near.hp).toBe(95)
    expect(near.pos.z).toBeCloseTo(-3)
    expect(near.stagger).toBe(0.6)
    expect(r.enemies.find((e) => e.uid === 'far')!.hp).toBe(100)
  })
  it('staggers a Brute 0.3 s with no push', () => {
    const b = resolveKick(origin, fwd, [mk('brute', -1)], ctx).enemies[0]
    expect(b.hp).toBe(95)
    expect(b.stagger).toBe(0.3)
    expect(b.pos.z).toBe(-1)
  })
  it('deals damage only to Father Crane', () => {
    const c = resolveKick(origin, fwd, [mk('father-crane', -1)], ctx).enemies[0]
    expect(c.hp).toBe(95)
    expect(c.stagger).toBe(0)
    expect(c.pos.z).toBe(-1)
  })
  it('stops the push at the last free step', () => {
    const blocked = (_a: unknown, b: { z: number }) => b.z < -2
    const r = resolveKick(origin, fwd, [mk('shambler', -1)], ctx, blocked)
    expect(r.enemies[0].pos.z).toBeCloseTo(-2)
  })
  it('finds no target behind the player', () => {
    const r = resolveKick(origin, fwd, [mk('shambler', 1)], ctx)
    expect(r.targetUid).toBeNull()
    expect(r.killed).toBe(false)
  })
  it('reports a kill', () => {
    expect(resolveKick(origin, fwd, [mk('shambler', -1, 'a', 3)], ctx).killed).toBe(true)
  })
})

// Feature: 07-combat-and-enemies, Property 18: Kick and Dodge are gated, bounded and invulnerable only at the start
describe('Property 18 (kick)', () => {
  it('acts iff stamina and cooldown allow, spends exactly the cost, stays in 0..100', () => {
    // **Validates: Requirements 9.1, 9.5, 9.7, 9.8, 9.10**
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 100, noNaN: true }),
        fc.double({ min: 0, max: 2, noNaN: true }),
        (stamina, cd) => {
          const s = { stamina, regenDelayTimer: 0 }
          const ok = canKick(stamina, cd)
          expect(ok).toBe(stamina >= KICK.staminaCost && cd <= 0)
          const r = ok ? spendStamina(s, KICK.staminaCost) : { state: s, ok: false }
          if (ok) expect(r.state.stamina).toBeCloseTo(stamina - KICK.staminaCost, 9)
          else expect(r.state).toBe(s)
          expect(r.state.stamina).toBeGreaterThanOrEqual(0)
          expect(r.state.stamina).toBeLessThanOrEqual(100)
        },
      ),
    )
  })
  it('pushes only ordinary types and never changes a target count', () => {
    // **Validates: Requirements 9.1, 9.2, 9.3**
    const types: EnemyId[] = ['shambler', 'lurker', 'wailer', 'bloater', 'brute', 'father-crane']
    fc.assert(
      fc.property(fc.constantFrom(...types), fc.double({ min: 0.3, max: 1.7, noNaN: true }), (t, d) => {
        const e = resolveKick(origin, fwd, [mk(t, -d, 'a', 1000)], ctx).enemies[0]
        const moved = Math.abs(e.pos.z + d)
        if (t === 'brute' || t === 'father-crane') expect(moved).toBe(0)
        else expect(moved).toBeCloseTo(KICK.pushM, 9)
        expect(e.stagger).toBe(t === 'father-crane' ? 0 : t === 'brute' ? 0.3 : 0.6)
        expect(e.hp).toBe(995)
      }),
    )
  })
})
