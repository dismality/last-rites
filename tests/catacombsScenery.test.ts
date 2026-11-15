// Spec 09 task 11n-c: the catacombs scene's JSON loads, the four spots and two relics rest on
// their surfaces, and the corridor keeps its width.
import { describe, expect, it } from 'vitest'
import raw from '../public/assets/models/scene/catacombs.json'
import { CATACOMB_BOXES, CATACOMB_SURFACES } from '../src/data/catacombsScenery'
import { CATACOMBS } from '../src/data/cemeteryLayout'
import { OSSUARY_DOOR } from '../src/data/gateHints'
import { FIXED_SPAWNS, SPAWN_POINTS } from '../src/data/zones'

const spot = (id: string) =>
  (SPAWN_POINTS.find((p) => p.id === id) ?? FIXED_SPAWNS.find((p) => p.id === id))!.position
const inside = (note: string, p: readonly number[]) =>
  CATACOMB_BOXES.some(
    (b) =>
      b.note === note &&
      Math.abs(p[0] - b.center[0]) <= b.half[0] &&
      Math.abs(p[2] - b.center[2]) <= b.half[2],
  )

describe('catacombs scene JSON', () => {
  it('loads 9 finite boxes and the surfaces', () => {
    expect(CATACOMB_BOXES).toHaveLength(9)
    for (const b of CATACOMB_BOXES) {
      for (const v of [...b.center, ...b.half, b.rotY]) expect(Number.isFinite(v)).toBe(true)
      expect(b.half.every((h) => h > 0)).toBe(true)
    }
    expect(CATACOMB_SURFACES).toEqual({ ledgeY: 0.95, bierTopY: 0.78, altarTopY: 0.78 })
  })
})

describe('catacomb items rest on their surfaces', () => {
  it.each([
    ['cat-wall-a', 'ledge', CATACOMB_SURFACES.ledgeY],
    ['cat-wall-b', 'ledge', CATACOMB_SURFACES.ledgeY],
    ['cat-wall-c', 'ledge', CATACOMB_SURFACES.ledgeY],
    ['fx-page-4', 'bier', CATACOMB_SURFACES.bierTopY],
    ['fx-shroud', 'bier', CATACOMB_SURFACES.bierTopY],
    ['fx-heart', 'reliquary altar', CATACOMB_SURFACES.altarTopY],
  ])('%s is on the %s', (id, note, y) => {
    const p = spot(id)
    expect(Math.abs(p[1] - y)).toBeLessThanOrEqual(0.03)
    expect(inside(note, p)).toBe(true)
  })

  it('every move-item target in the JSON is within 0.03 m of the game spot', () => {
    const targets = Object.entries(raw.surfaces['move-items']).map(
      ([k, v]) => [k.split(' ')[0], v] as const,
    )
    for (const [id, v] of targets) {
      const p = spot(id)
      expect(Math.hypot(p[0] - v[0], p[1] - v[1], p[2] - v[2]), id).toBeLessThanOrEqual(0.03)
    }
  })
})

describe('corridor width', () => {
  it('keeps 1.6 m clear from the entrance to the ossuary door, at every z', () => {
    const half = CATACOMBS.width / 2
    const x0 = CATACOMBS.centerX - half
    const x1 = CATACOMBS.centerX + half
    for (let z = CATACOMBS.entranceZ; z <= OSSUARY_DOOR.z; z += 0.05) {
      // Free span = the corridor minus the union of boxes covering this z (boxes here are axis-aligned inside).
      const spans = CATACOMB_BOXES.filter(
        (b) =>
          b.rotY === 0 &&
          z >= b.center[2] - b.half[2] &&
          z <= b.center[2] + b.half[2] &&
          b.center[1] - b.half[1] < 1.8,
      ).map(
        (b) =>
          [Math.max(x0, b.center[0] - b.half[0]), Math.min(x1, b.center[0] + b.half[0])] as const,
      )
      const blocked = spans.filter(([a, b]) => b > a).reduce((s, [a, b]) => s + (b - a), 0)
      expect(x1 - x0 - blocked, `z ${z.toFixed(2)}`).toBeGreaterThanOrEqual(1.6)
    }
  })
})
