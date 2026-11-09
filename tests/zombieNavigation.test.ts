// Playtest bug (spec 08 task 10.3): with the player at the hut start, night 1 zombies stalled
// 21–44 m away, flipping between two points every frame. These tests run the real enemy AI over
// the real waypoint graph and the real wall layout from every wave grave.
import { describe, expect, it } from 'vitest'
import { ENEMY_MAP } from '../src/data/enemies'
import { WAVE_GRAVES } from '../src/data/waves'
import { WAYPOINT_EDGES, WAYPOINT_NODES } from '../src/data/waypoints'
import type { Vec2 } from '../src/game/systems/combat'
import { createEnemy, tickEnemies, type AIEnemy } from '../src/game/systems/enemyAI'
import { DEFAULT_GRAPH } from '../src/game/systems/navigation'
import { makeBlocked, propBoxes, structureBoxes } from './helpers/layoutWalls'

const DT = 1 / 60
const structures = structureBoxes()
const blockedByStructures = makeBlocked(structures)
const blocked = makeBlocked([...structures, ...propBoxes()])

const PLAYERS: Record<string, Vec2[]> = {
  'hut start': [{ x: 0, z: 0 }],
  chapel: [
    { x: 10, z: 5 },
    { x: 10, z: 9.5 },
  ],
  'open grounds': [
    { x: -15, z: 18 },
    { x: 20, z: -14 },
    { x: -8, z: -22 },
    { x: 18, z: 26 },
  ],
}

const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.z - b.z)

/** A generous but finite bound: Manhattan length stands in for a detour, doubled for crowding. */
function boundS(from: Vec2, to: Vec2, speed: number): number {
  return (((Math.abs(from.x - to.x) + Math.abs(from.z - to.z)) * 1.25) / speed) * 2 + 10
}

interface Run {
  arrivedAt: number | null
  reversals: number
}

function simulate(horde: AIEnemy[], player: Vec2, limitS: number, crowdingM = 0): Run[] {
  const range = ENEMY_MAP.shambler.attackRange + crowdingM
  const runs: Run[] = horde.map(() => ({ arrivedAt: null, reversals: 0 }))
  const lastStep: (Vec2 | null)[] = horde.map(() => null)
  let zs = horde
  const ctx = { playerPos: player, playerFacing: { x: 0, z: -1 }, lanternFuel: 100, blocked }
  for (let i = 0; i < limitS / DT; i++) {
    const before = zs.map((z) => z.pos)
    zs = tickEnemies(zs, DT, ctx).enemies
    zs.forEach((z, k) => {
      const run = runs[k]
      if (run.arrivedAt !== null) return
      const step = { x: z.pos.x - before[k].x, z: z.pos.z - before[k].z }
      const prev = lastStep[k]
      const min = 0.3 * ENEMY_MAP.shambler.speed * DT
      if (prev && Math.hypot(step.x, step.z) > min && Math.hypot(prev.x, prev.z) > min) {
        if (step.x * prev.x + step.z * prev.z < 0) run.reversals++
      }
      lastStep[k] = step
      if (dist(z.pos, player) <= range) run.arrivedAt = i * DT
    })
    if (runs.every((r) => r.arrivedAt !== null)) break
  }
  return runs
}

const shamblerAt = (g: { id: string; x: number; z: number }, tag: string): AIEnemy =>
  createEnemy(`${tag}-${g.id}`, 'shambler', { x: g.x, z: g.z })

describe('zombies reach the player through the real layout', () => {
  for (const [name, spots] of Object.entries(PLAYERS)) {
    for (const player of spots) {
      it(`every wave grave -> ${name} (${player.x}, ${player.z}), one at a time`, () => {
        for (const g of WAVE_GRAVES) {
          const [run] = simulate([shamblerAt(g, 'solo')], player, 200)
          const limit = boundS(g, player, ENEMY_MAP.shambler.speed)
          expect(run.arrivedAt, `${g.id} stalled`).not.toBeNull()
          expect(run.arrivedAt as number, `${g.id} too slow`).toBeLessThanOrEqual(limit)
          // The old bug flipped direction every frame; a healthy walk reverses a handful of times at most.
          expect(run.reversals, `${g.id} oscillates`).toBeLessThanOrEqual(5)
        }
      })

      it(`a night 1 wave of 4 at once -> ${name} (${player.x}, ${player.z})`, () => {
        // Separation keeps bodies 1 m apart, so zombies queuing behind the first may stop a little
        // outside attack range; allow for that rather than for a stall.
        const graves = WAVE_GRAVES.filter((_, i) => i % 2 === 0)
        const horde = graves.map((g) => shamblerAt(g, 'horde'))
        const runs = simulate(horde, player, 200, 1.5)
        runs.forEach((run, k) => {
          const g = graves[k]
          expect(run.arrivedAt, `${g.id} stalled`).not.toBeNull()
          expect(run.arrivedAt as number, `${g.id} too slow`).toBeLessThanOrEqual(
            boundS(g, player, ENEMY_MAP.shambler.speed) + 20,
          )
        })
      })
    }
  }
})

describe('waypoint graph against the real structures', () => {
  it('every edge is walkable past the hut, chapel, fences and corridor walls', () => {
    for (const [a, b] of WAYPOINT_EDGES) {
      const pa = DEFAULT_GRAPH.nodes.get(a)!
      const pb = DEFAULT_GRAPH.nodes.get(b)!
      expect(blockedByStructures(pa, pb), `${a} - ${b}`).toBe(false)
    }
  })

  it('no node sits inside a structure', () => {
    for (const n of WAYPOINT_NODES) {
      const p = { x: n.x, z: n.z }
      const hit = structures.some((s) => Math.abs(p.x - s.cx) <= s.hx && Math.abs(p.z - s.cz) <= s.hz)
      expect(hit, n.id).toBe(false)
    }
  })
})
