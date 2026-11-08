import { describe, expect, it } from 'vitest'
import * as fc from 'fast-check'
import { ENEMY_MAP, type EnemyId } from '../../data/enemies'
import { WEAPON_MAP } from '../../data/weapons'
import { MELEE_ARC_DEG, MELEE_RANGE_M } from '../../data/balance'
import { aoe, applyDamage, meleeHits, type CombatEnemy, type DamageContext } from './combat'

const enemyAt = (uid: string, x: number, z: number, type: EnemyId = 'shambler'): CombatEnemy => ({
  uid,
  type,
  hp: ENEMY_MAP[type].hp,
  pos: { x, z },
})

const ORIGIN = { x: 0, z: 0 }
const FORWARD = { x: 0, z: 1 }
const rad = (deg: number) => (deg * Math.PI) / 180

describe('meleeHits', () => {
  it('hits an enemy straight ahead within range', () => {
    expect(meleeHits(ORIGIN, FORWARD, MELEE_ARC_DEG, MELEE_RANGE_M, [enemyAt('a', 0, 1.5)])).toEqual(['a'])
  })

  it('misses enemies behind, beyond range, or outside the cone', () => {
    const enemies = [enemyAt('behind', 0, -1), enemyAt('far', 0, 2.5), enemyAt('side', 1.5, 0.2)]
    expect(meleeHits(ORIGIN, FORWARD, MELEE_ARC_DEG, MELEE_RANGE_M, enemies)).toEqual([])
  })

  it('ignores dead enemies and a zero direction', () => {
    const dead = { ...enemyAt('dead', 0, 1), hp: 0 }
    expect(meleeHits(ORIGIN, FORWARD, MELEE_ARC_DEG, MELEE_RANGE_M, [dead])).toEqual([])
    expect(meleeHits(ORIGIN, { x: 0, z: 0 }, MELEE_ARC_DEG, MELEE_RANGE_M, [enemyAt('a', 0, 1)])).toEqual([])
  })

  it('property: returns exactly the enemies in range and arc', () => {
    // Offsets keep samples away from the exact boundary to avoid float ties.
    const arbDist = fc.double({ min: 0.05, max: 4, noNaN: true }).filter((d) => Math.abs(d - MELEE_RANGE_M) > 1e-6)
    const arbAngle = fc
      .double({ min: -180, max: 180, noNaN: true })
      .filter((a) => Math.abs(Math.abs(a) - MELEE_ARC_DEG / 2) > 1e-6)
    fc.assert(
      fc.property(
        fc.double({ min: -50, max: 50, noNaN: true }),
        fc.double({ min: -50, max: 50, noNaN: true }),
        fc.double({ min: -Math.PI, max: Math.PI, noNaN: true }),
        fc.array(fc.tuple(arbDist, arbAngle), { maxLength: 12 }),
        (ox, oz, facing, polar) => {
          const origin = { x: ox, z: oz }
          const dir = { x: Math.sin(facing), z: Math.cos(facing) }
          const enemies = polar.map(([d, a], i) => {
            const ang = facing + rad(a)
            return enemyAt(`e${i}`, ox + Math.sin(ang) * d, oz + Math.cos(ang) * d)
          })
          const expected = polar
            .map(([d, a], i) => (d <= MELEE_RANGE_M && Math.abs(a) <= MELEE_ARC_DEG / 2 ? `e${i}` : null))
            .filter((x): x is string => x !== null)
          expect(meleeHits(origin, dir, MELEE_ARC_DEG, MELEE_RANGE_M, enemies)).toEqual(expected)
        },
      ),
    )
  })
})

describe('applyDamage', () => {
  const lit: DamageContext = { lanternFuel: 50 }
  const dark: DamageContext = { lanternFuel: 0 }

  it('subtracts weapon damage', () => {
    expect(applyDamage(enemyAt('a', 0, 0), 15, lit).hp).toBe(45)
  })

  it('halves damage while lantern fuel is 0', () => {
    expect(applyDamage(enemyAt('a', 0, 0), 20, dark).hp).toBe(50)
  })

  it('doubles flask damage against wailers only', () => {
    const flask = WEAPON_MAP['holy-water-flask'].damage
    const ctx: DamageContext = { lanternFuel: 50, source: 'holy-water-flask' }
    expect(applyDamage(enemyAt('w', 0, 0, 'wailer'), flask, ctx).hp).toBe(0)
    expect(applyDamage(enemyAt('s', 0, 0, 'shambler'), flask, ctx).hp).toBe(20)
  })

  it('does not mutate the input', () => {
    const e = enemyAt('a', 0, 0)
    applyDamage(e, 10, lit)
    expect(e.hp).toBe(60)
  })

  it('property: HP never rises and never drops below 0', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<EnemyId>('shambler', 'lurker', 'wailer'),
        fc.double({ min: 0, max: 200, noNaN: true }),
        fc.double({ min: -500, max: 500, noNaN: true }),
        fc.double({ min: 0, max: 100, noNaN: true }),
        fc.constantFrom('holy-water-flask', 'melee', 'nail-bomb', undefined),
        (type, hp, dmg, lanternFuel, source) => {
          const before = { ...enemyAt('x', 0, 0, type), hp }
          const after = applyDamage(before, dmg, { lanternFuel, source })
          expect(after.hp).toBeLessThanOrEqual(before.hp)
          expect(after.hp).toBeGreaterThanOrEqual(0)
        },
      ),
    )
  })

  it('property: darkness never increases damage dealt', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<EnemyId>('shambler', 'lurker', 'wailer'),
        fc.double({ min: 0, max: 200, noNaN: true }),
        (type, dmg) => {
          const e = enemyAt('x', 0, 0, type)
          const litHp = applyDamage(e, dmg, { lanternFuel: 40 }).hp
          const darkHp = applyDamage(e, dmg, { lanternFuel: 0 }).hp
          expect(darkHp).toBeGreaterThanOrEqual(litHp)
        },
      ),
    )
  })
})

describe('aoe', () => {
  it('uses flask and bomb radii from weapon data', () => {
    const flaskR = WEAPON_MAP['holy-water-flask'].radius!
    const bombR = WEAPON_MAP['nail-bomb'].radius!
    const enemies = [enemyAt('near', 1.5, 0), enemyAt('mid', 2.5, 0), enemyAt('far', 3.5, 0)]
    expect(aoe(ORIGIN, flaskR, enemies)).toEqual(['near'])
    expect(aoe(ORIGIN, bombR, enemies)).toEqual(['near', 'mid'])
  })

  it('property: returns exactly the living enemies within the radius', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.5, max: 6, noNaN: true }),
        fc.array(
          fc.record({
            x: fc.double({ min: -10, max: 10, noNaN: true }),
            z: fc.double({ min: -10, max: 10, noNaN: true }),
            alive: fc.boolean(),
          }),
          { maxLength: 20 },
        ),
        (radius, pts) => {
          const enemies = pts.map((p, i) => ({ ...enemyAt(`e${i}`, p.x, p.z), hp: p.alive ? 10 : 0 }))
          const got = new Set(aoe(ORIGIN, radius, enemies))
          for (const e of enemies) {
            const inside = Math.hypot(e.pos.x, e.pos.z) <= radius && e.hp > 0
            expect(got.has(e.uid)).toBe(inside)
          }
        },
      ),
    )
  })
})
