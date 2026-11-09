import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { DOORS } from '../../data/barricades'
import type { EnemyId } from '../../data/enemies'
import { NIGHT_MAP, WAVE_GRAVES, waveSize, type NightNumber } from '../../data/waves'
import { createRng } from '../rng'
import type { DoorId } from '../types'
import { buildBarricades, doorAttackerCount, type BarricadeState } from './barricade'
import {
  CHAPEL_DOOR_GEOM,
  barricadeFor,
  chapelSafe,
  chooseTarget,
  closedDoorBlocks,
  doorClosed,
  ejectFromClosedDoors,
  insideChapel,
} from './chapelDoors'
import type { AIState } from './enemyAI'
import { startNight, tickWaves } from './waves'

const boardsArb = fc.array(fc.integer({ min: 1, max: 75 }), { maxLength: DOORS.slots })
const stateArb: fc.Arbitrary<BarricadeState> = fc.record({
  built: fc.boolean(),
  doors: fc.record({ front: boardsArb, vestry: boardsArb }),
})
const posArb = fc.record({ x: fc.double({ min: -5, max: 25, noNaN: true }), z: fc.double({ min: -8, max: 18, noNaN: true }) })
const ids: DoorId[] = ['front', 'vestry']

describe('chapel door rules', () => {
  it('knows the chapel interior', () => {
    expect(insideChapel({ x: 10, z: 5 })).toBe(true)
    expect(insideChapel({ x: 10, z: -3 })).toBe(false)
  })

  it('a fresh barricade is safe, and one empty door is not', () => {
    const s = buildBarricades(60)
    expect(chapelSafe(s)).toBe(true)
    expect(chapelSafe({ ...s, doors: { ...s.doors, vestry: [] } })).toBe(false)
  })

  it('stage 1 missing from the chapel state means no barricade', () => {
    const s = buildBarricades(60)
    const chapel = { completedStages: [], altarHealedToday: false, finalRiteActive: false }
    expect(barricadeFor(chapel, s).built).toBe(false)
    expect(barricadeFor({ ...chapel, completedStages: ['barDoor'] } as never, s)).toBe(s)
  })

  it('blocks a segment through a closed door only', () => {
    const g = CHAPEL_DOOR_GEOM.front
    const out = { x: g.standPoint.x, z: g.standPoint.z }
    const inn = { x: g.pos.x, z: g.pos.z + 1 }
    expect(closedDoorBlocks({ front: true, vestry: false })(out, inn)).toBe(true)
    expect(closedDoorBlocks({ front: false, vestry: false })(out, inn)).toBe(false)
  })

  it('Property 26: doors are closed iff built and holding; safe iff both closed', () => {
    fc.assert(
      fc.property(stateArb, (s) => {
        for (const id of ids) expect(doorClosed(s, id)).toBe(s.built && s.doors[id].length >= 1)
        expect(chapelSafe(s)).toBe(doorClosed(s, 'front') && doorClosed(s, 'vestry'))
      }),
    )
  })

  it('Property 26: ejection leaves nobody inside a closed doorway', () => {
    fc.assert(
      fc.property(fc.array(posArb, { maxLength: 8 }), fc.boolean(), fc.boolean(), (ps, f, v) => {
        const closed = { front: f, vestry: v }
        const list = ps.map((pos) => ({ pos, state: 'chase' as AIState }))
        const out = ejectFromClosedDoors(list, closed)
        const blocks = closedDoorBlocks(closed)
        for (const e of out) {
          for (const id of ids) {
            if (!closed[id]) continue
            const g = CHAPEL_DOOR_GEOM[id]
            const dx = e.pos.x - g.pos.x
            const dz = e.pos.z - g.pos.z
            const across = dx * g.outward.x + dz * g.outward.z
            const along = -dx * g.outward.z + dz * g.outward.x
            expect(Math.abs(along) > g.widthM / 2 || Math.abs(across) > 0.3).toBe(true)
          }
        }
        expect(out).toHaveLength(list.length)
        expect(blocks).toBeTypeOf('function')
      }),
    )
  })

  it('Property 26: targets follow the rules', () => {
    fc.assert(
      fc.property(stateArb, posArb, fc.boolean(), fc.boolean(), fc.boolean(), (barricade, pos, doorAttacker, playerInside, night) => {
        const t = chooseTarget({ doorAttacker, pos }, { barricade, playerInside, night })
        const open = ids.filter((id) => barricade.doors[id].length > 0)
        const goesToDoor = barricade.built && night && (playerInside || doorAttacker) && open.length > 0
        if (!goesToDoor) {
          expect(t).toBe('player')
          return
        }
        const dist = (id: DoorId) =>
          Math.hypot(CHAPEL_DOOR_GEOM[id].pos.x - pos.x, CHAPEL_DOOR_GEOM[id].pos.z - pos.z)
        expect(open).toContain(t)
        for (const id of open) expect(dist(t as DoorId)).toBeLessThanOrEqual(dist(id))
      }),
    )
  })

  it('Property 26: a wave of N has max(floor(N/3), night>=2 ? 1 : 0) Door_Attackers through tickWaves', () => {
    const eligible = (t: EnemyId) => t === 'shambler' || t === 'brute'
    fc.assert(
      fc.property(fc.constantFrom<NightNumber>(1, 2, 3, 4, 5), fc.integer({ min: 1, max: 1000 }), (night, seed) => {
        const def = NIGHT_MAP[night]
        const n = waveSize(def.waves[0])
        const elig = Object.entries(def.waves[0]).reduce(
          (a, [k, v]) => a + (eligible(k as EnemyId) ? (v as number) : 0),
          0,
        )
        const want = Math.min(doorAttackerCount(n, night), elig)
        const tick = tickWaves(startNight(night), 1 / 60, {
          playerPos: { x: 0, z: 0 },
          liveCount: 0,
          rng: createRng(seed),
          graves: WAVE_GRAVES,
        })
        const spawned = tick.spawns.length
        const got = tick.spawns.filter((s) => s.doorAttacker).length
        if (spawned === n) expect(got).toBe(want)
        expect(got).toBeLessThanOrEqual(want)
        expect(tick.spawns.every((s) => !s.doorAttacker || eligible(s.type))).toBe(true)
      }),
    )
  })
})
