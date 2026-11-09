import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { BLOATER } from '../../data/enemies'
import { resolveBurst } from './bloater'
import type { CombatEnemy, DamageContext } from './combat'

const ctx: DamageContext = { lanternFuel: 50 }
const zombie = (uid: string, x: number, z: number, hp = 60, type: CombatEnemy['type'] = 'shambler'): CombatEnemy => ({
  uid,
  type,
  hp,
  pos: { x, z },
})
const origin = { x: 0, z: 0 }

describe('resolveBurst', () => {
  it('hurts neighbours inside 3 m, spares those outside, never the source', () => {
    const src = zombie('src', 0, 0, 0, 'bloater')
    const res = resolveBurst(origin, 'src', [src, zombie('a', 3, 0), zombie('b', 3.01, 0)], { x: 10, z: 0 }, ctx)
    expect(res.enemies.find((e) => e.uid === 'a')?.hp).toBe(35)
    expect(res.enemies.find((e) => e.uid === 'b')?.hp).toBe(60)
    expect(res.hitUids).toEqual(['a'])
    expect(res.playerDamage).toBe(0)
  })

  it('reports a chained Bloater taken to 0 HP, and leaves a swelling one alone', () => {
    const src = zombie('src', 0, 0, 0, 'bloater')
    const weak = zombie('weak', 1, 0, 25, 'bloater')
    const swelling = zombie('swell', 1, 1, 0, 'bloater')
    const res = resolveBurst(origin, 'src', [src, weak, swelling], { x: 9, z: 9 }, ctx)
    expect(res.killedUids).toEqual(['weak'])
  })

  it('caps player damage at current health', () => {
    expect(resolveBurst(origin, 's', [], { x: 1, z: 0 }, ctx, 10).playerDamage).toBe(10)
    expect(resolveBurst(origin, 's', [], { x: 1, z: 0 }, ctx, 100).playerDamage).toBe(BLOATER.burstDamage)
  })
})

describe('Property 22: The Bloater bursts once and only inside 3 m', () => {
  const coord = fc.double({ min: -6, max: 6, noNaN: true })
  const pos = fc.record({ x: coord, z: coord })

  /** **Validates: Requirements 13.3, 13.5, 13.8, 13.9, 13.10** */
  it('damages a target if and only if it is within 3 m, and never the source', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ p: pos, hp: fc.integer({ min: 1, max: 100 }) }), { maxLength: 12 }),
        pos,
        fc.integer({ min: 0, max: 150 }),
        (list, player, playerHp) => {
          const src = zombie('src', 0, 0, 0, 'bloater')
          const zs = list.map((z, i) => zombie(`z${i}`, z.p.x, z.p.z, z.hp))
          const res = resolveBurst(origin, 'src', [src, ...zs], player, ctx, playerHp)
          expect(res.enemies.find((e) => e.uid === 'src')).toEqual(src)
          zs.forEach((z) => {
            const after = res.enemies.find((e) => e.uid === z.uid)!
            const inside = Math.hypot(z.pos.x, z.pos.z) <= BLOATER.burstRadiusM
            expect(after.hp).toBe(inside ? Math.max(0, z.hp - BLOATER.burstDamage) : z.hp)
            expect(res.hitUids.includes(z.uid)).toBe(inside)
            expect(res.killedUids.includes(z.uid)).toBe(inside && z.hp <= BLOATER.burstDamage)
          })
          const close = Math.hypot(player.x, player.z) <= BLOATER.burstRadiusM
          expect(res.playerDamage).toBe(close ? Math.min(BLOATER.burstDamage, playerHp) : 0)
          expect(playerHp - res.playerDamage).toBeGreaterThanOrEqual(0)
          // Above 25 HP the burst alone can never kill the player.
          if (playerHp > BLOATER.burstDamage) expect(playerHp - res.playerDamage).toBeGreaterThan(0)
        },
      ),
    )
  })

  it('is deterministic: the same burst resolved twice gives the same result (no repeat damage state)', () => {
    const zs = [zombie('src', 0, 0, 0, 'bloater'), zombie('a', 1, 1, 80, 'bloater')]
    const a = resolveBurst(origin, 'src', zs, { x: 0, z: 1 }, ctx, 100)
    const b = resolveBurst(origin, 'src', zs, { x: 0, z: 1 }, ctx, 100)
    expect(a).toEqual(b)
    expect(zs[1].hp).toBe(80)
  })
})
