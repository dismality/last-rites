// Pins how long chapel barricades last against the design bible numbers (§2 Barricades, §7).
// Why: a night 3 playtest saw 3 + 2 boards gone ~20 s after 6 zombies arrived. The maths below shows
// the design allows far less than that once they stand at the doors, so the walk-in and bunching
// account for the rest and nothing needed changing.
import { describe, expect, it } from 'vitest'
import { DOORS } from '../src/data/barricades'
import { ENEMY_MAP, ENEMY_ATTACK_DURATION_S, ENEMY_ATTACK_WINDUP_S } from '../src/data/enemies'
import { boardDamageFor, damageDoor, type BarricadeState } from '../src/game/systems/barricade'
import { CHAPEL_DOOR_GEOM } from '../src/game/systems/chapelDoors'
import { createEnemy, tickEnemy, type AIEnemy, type AIEvent } from '../src/game/systems/enemyAI'
import type { DoorId } from '../src/game/types'

const DT = 1 / 60
const HARDENED = DOORS.boardHp * 1.25

const state = (front: number, vestry: number, hp: number): BarricadeState => ({
  built: true,
  doors: { front: Array(front).fill(hp), vestry: Array(vestry).fill(hp) },
})

/** Zombies already at their door's stand point, hitting with the real AI; returns seconds until `door` has no boards. */
function simulate(
  start: BarricadeState,
  groups: readonly { door: DoorId; type: 'shambler' | 'brute'; n: number }[],
  rite = false,
): Record<DoorId, number> {
  let s = start
  const doors = {
    front: CHAPEL_DOOR_GEOM.front.standPoint,
    vestry: CHAPEL_DOOR_GEOM.vestry.standPoint,
  }
  let zs: AIEnemy[] = groups.flatMap((g, gi) =>
    Array.from({ length: g.n }, (_, i) => ({
      ...createEnemy(`${gi}-${i}`, g.type, { ...doors[g.door] }),
      state: 'chase' as const,
      target: g.door,
    })),
  )
  const broken: Record<DoorId, number> = { front: Infinity, vestry: Infinity }
  for (let step = 1; step <= 60 * 120; step++) {
    const events: AIEvent[] = []
    zs = zs.map((z) => {
      const r = tickEnemy(z, DT, { playerPos: { x: 0, z: 0 }, playerFacing: { x: 0, z: 1 }, lanternFuel: 100, doors })
      events.push(...r.events)
      return r.enemy
    })
    for (const ev of events) {
      if (ev.type !== 'enemyAttack' || ev.target === 'player') continue
      s = damageDoor(s, ev.target, boardDamageFor(ev.damage, ev.enemyType, rite)).state
    }
    for (const id of ['front', 'vestry'] as const) {
      if (s.doors[id].length === 0 && broken[id] === Infinity) broken[id] = step * DT
    }
    if (broken.front < Infinity && broken.vestry < Infinity) break
  }
  return broken
}

describe('barricade strength (design bible)', () => {
  const shambler = ENEMY_MAP.shambler
  const period = Math.max(shambler.attackCooldown, ENEMY_ATTACK_DURATION_S)

  it('uses the design numbers', () => {
    expect(DOORS.boardHp).toBe(60)
    expect(shambler.damage).toBe(10)
    expect(shambler.attackCooldown).toBe(1.5)
    expect(ENEMY_MAP.brute.damage).toBe(30)
    expect(boardDamageFor(30, 'brute', false)).toBe(60)
    expect(boardDamageFor(10, 'shambler', true)).toBe(20)
  })

  it('one shambler breaks a 60 HP board in 6 blows, 0.4 s + 5 x 1.5 s = 7.9 s', () => {
    const t = simulate(state(1, 0, 60), [{ door: 'front', type: 'shambler', n: 1 }])
    const expected = ENEMY_ATTACK_WINDUP_S + 5 * period
    expect(expected).toBeCloseTo(7.9)
    expect(t.front).toBeGreaterThanOrEqual(expected - 0.05)
    expect(t.front).toBeLessThanOrEqual(expected + 0.25)
  })

  it('6 shamblers (3 per door) clear front 3 boards by 7.9 s and vestry 2 boards by 4.9 s', () => {
    const groups = [
      { door: 'front', type: 'shambler', n: 3 },
      { door: 'vestry', type: 'shambler', n: 3 },
    ] as const
    const t = simulate(state(3, 2, 60), groups)
    expect(t.front).toBeGreaterThan(7.7)
    expect(t.front).toBeLessThan(8.25)
    expect(t.vestry).toBeGreaterThan(4.7)
    expect(t.vestry).toBeLessThan(5.25)
  })

  it('Hardened Boards (75 HP) lasts longer: 8 blows per board (7.5 rounded up), 10.9 s per shambler', () => {
    const t = simulate(state(1, 0, HARDENED), [{ door: 'front', type: 'shambler', n: 1 }])
    expect(t.front).toBeGreaterThan(ENEMY_ATTACK_WINDUP_S + 7 * period - 0.05)
    expect(t.front).toBeLessThanOrEqual(ENEMY_ATTACK_WINDUP_S + 7 * period + 0.25)
  })

  it('a brute does 60 per blow: one board per blow, 3 boards in 0.4 s + 2 x 1.5 s = 3.4 s', () => {
    const t = simulate(state(3, 0, 60), [{ door: 'front', type: 'brute', n: 1 }])
    expect(t.front).toBeGreaterThan(3.3)
    expect(t.front).toBeLessThan(3.6)
  })

  it('the final rite doubles board damage, halving the time for 2 boards under 1 shambler', () => {
    const normal = simulate(state(1, 0, 60), [{ door: 'front', type: 'shambler', n: 1 }])
    const rite = simulate(state(1, 0, 60), [{ door: 'front', type: 'shambler', n: 1 }], true)
    // 20 per blow: 3 blows = 0.4 + 2 x 1.5 = 3.4 s versus 7.9 s.
    expect(rite.front).toBeGreaterThan(3.3)
    expect(rite.front).toBeLessThan(3.6)
    expect(normal.front).toBeGreaterThan(rite.front)
  })
})
