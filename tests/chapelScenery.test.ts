// Spec 09 task 11n-a: the chapel scene's JSON loads, its colliders keep the way clear, the chapel's
// items rest on their surfaces, and zombies still reach the altar and the vestry through the pews.
import { describe, expect, it } from 'vitest'
import {
  CHAPEL_ANCHORS,
  CHAPEL_EXTERIOR_BOXES,
  CHAPEL_INTERIOR_BOXES,
  CHAPEL_SURFACES,
  HYMN_BOARD_NUMBERS,
  HYMN_BOARD_POSITION,
} from '../src/data/chapelScenery'
import { CHAPEL_CENTER, CHAPEL_CUPBOARD_POSITION, CHAPEL_DOORS, CONGREGATION_POINTS } from '../src/data/cemeteryLayout'
import { itemSizeM, groundPose } from '../src/data/itemModels'
import { ITEM_MAP } from '../src/data/items'
import { FIXED_SPAWNS, SPAWN_POINTS } from '../src/data/zones'
import { ENEMY_MAP } from '../src/data/enemies'
import { WAVE_GRAVES } from '../src/data/waves'
import {
  CHAPEL_AISLE,
  chapelSceneColliders,
  clearAisle,
  crossesAisle,
  droppedColliders,
} from '../src/game/systems/chapelColliders'
import type { ChapelBox } from '../src/data/chapelScenery'
import { createEnemy, tickEnemies, type AIEnemy } from '../src/game/systems/enemyAI'
import { makeBlocked, propBoxes, structureBoxes } from './helpers/layoutWalls'

const local = (p: readonly number[]) => ({ x: p[0] - CHAPEL_CENTER[0], z: p[2] - CHAPEL_CENTER[2] })
const inside = (b: ChapelBox, p: { x: number; z: number }, margin = 0) =>
  Math.abs(p.x - b.center[0]) < b.half[0] + margin && Math.abs(p.z - b.center[2]) < b.half[2] + margin

describe('chapel scene JSON', () => {
  it('loads: 10 interior boxes, 14 buttresses, the anchors and the surfaces', () => {
    expect(CHAPEL_INTERIOR_BOXES).toHaveLength(10)
    expect(CHAPEL_EXTERIOR_BOXES).toHaveLength(14)
    for (const b of [...CHAPEL_INTERIOR_BOXES, ...CHAPEL_EXTERIOR_BOXES]) {
      for (const v of [...b.center, ...b.half, b.rotY]) expect(Number.isFinite(v)).toBe(true)
      expect(b.half.every((h) => h > 0)).toBe(true)
      expect(b.rotY).toBe(0)
    }
    expect(CHAPEL_ANCHORS.bellPivot).toEqual([0, 6.03, -4.9])
    expect(CHAPEL_ANCHORS.doorLanternLight).toEqual([1.35, 1.88, -6.55])
    expect(CHAPEL_SURFACES).toEqual({
      lecternBookRestY: 0.97,
      fontLidY: 0.88,
      pewSeatY: 0.4,
      cupboardShelfY: 0.88,
      altarTopY: 1.0,
    })
  })
})

describe('chapel colliders keep the way clear', () => {
  const boxes = chapelSceneColliders()

  it('none stands in the centre aisle (world x 9.3..10.7, z -1..9.5)', () => {
    const inAisle = boxes.filter((b) => crossesAisle(b))
    expect(inAisle).toEqual([])
    for (const b of boxes) {
      const xMin = CHAPEL_CENTER[0] + b.center[0] - b.half[0]
      const xMax = CHAPEL_CENTER[0] + b.center[0] + b.half[0]
      const zMin = CHAPEL_CENTER[2] + b.center[2] - b.half[2]
      const zMax = CHAPEL_CENTER[2] + b.center[2] + b.half[2]
      const overlaps = xMin < 10.7 - 1e-6 && xMax > 9.3 + 1e-6 && zMin < 9.5 - 1e-6 && zMax > -1 + 1e-6
      expect(overlaps, `box at ${b.center}`).toBe(false)
    }
  })

  it('none covers a door, its stand point, the altar trigger or a congregation point', () => {
    const spots = [
      ...Object.values(CHAPEL_DOORS).flatMap((d) => [local(d.point), local(d.standPoint)]),
      { x: 0, z: 4.5 }, // the altar trigger (Chapel.tsx ALTAR_OFFSET)
      ...CONGREGATION_POINTS.map(local),
    ]
    for (const p of spots) {
      // The trigger sits exactly on the altar's front edge (the box was shortened to start there), so it is tested without a margin.
      for (const b of boxes) expect(inside(b, p), `(${p.x}, ${p.z}) in box at ${b.center}`).toBe(false)
    }
    // The doors and congregation points also keep a hand's width (0.1 m) from every box.
    for (const p of [...Object.values(CHAPEL_DOORS).flatMap((d) => [local(d.point), local(d.standPoint)]), ...CONGREGATION_POINTS.map(local)]) {
      for (const b of boxes) expect(inside(b, p, 0.1), `(${p.x}, ${p.z}) near box at ${b.center}`).toBe(false)
    }
  })

  it('shortens a pew rather than moving it, and drops only the lectern, which stands in the aisle', () => {
    const pews = CHAPEL_INTERIOR_BOXES.filter((b) => b.note === 'pew')
    expect(pews).toHaveLength(6)
    for (const pew of pews) {
      const cleared = clearAisle(pew)!
      // Same outer edge and the same z; only the inner edge moved, to the aisle edge.
      expect(cleared.center[2]).toBe(pew.center[2])
      expect(Math.min(Math.abs(cleared.center[0]) - cleared.half[0])).toBeCloseTo(CHAPEL_AISLE.halfWidth, 6)
      expect(Math.abs(cleared.center[0]) + cleared.half[0]).toBeCloseTo(Math.abs(pew.center[0]) + pew.half[0], 6)
    }
    expect(droppedColliders(CHAPEL_INTERIOR_BOXES).map((b) => b.note)).toEqual(['lectern'])
  })

  it('keeps the altar, shortened to start at the altar trigger line', () => {
    const altar = boxes.find((b) => b.note === 'altar')!
    expect(altar.center[2] - altar.half[2]).toBeCloseTo(CHAPEL_AISLE.zMax, 6)
    expect(altar.center[2] + altar.half[2]).toBeCloseTo(5.3, 6)
  })
})

describe('chapel items rest on their surfaces', () => {
  /** Gap between the item's underside (position y, the surface it rests on) and the surface. */
  const gap = (y: number, surface: number) => Math.abs(y - surface)
  const spawn = (id: string) => SPAWN_POINTS.find((p) => p.id === id)!
  const fixed = (id: string) => FIXED_SPAWNS.find((p) => p.id === id)!

  it('page 5 on the lectern book rest, tilted 14 degrees', () => {
    expect(gap(fixed('fx-page-5').position[1], CHAPEL_SURFACES.lecternBookRestY)).toBeLessThanOrEqual(0.03)
    expect(fixed('fx-page-5').tiltDeg).toBe(14)
    const p = local(fixed('fx-page-5').position)
    expect(p).toEqual({ x: 0, z: 0 })
  })

  it('font loot on the font lid, over the font', () => {
    const f = spawn('chapel-font')
    expect(gap(f.position[1], CHAPEL_SURFACES.fontLidY)).toBeLessThanOrEqual(0.03)
    const font = CHAPEL_INTERIOR_BOXES.find((b) => b.note === 'font')!
    expect(inside(font, local(f.position))).toBe(true)
  })

  it('pew loot on the west pew seat, with room for three stacks', () => {
    const f = spawn('chapel-pews')
    expect(gap(f.position[1], CHAPEL_SURFACES.pewSeatY)).toBeLessThanOrEqual(0.03)
    const pew = CHAPEL_INTERIOR_BOXES.find((b) => b.note === 'pew' && b.center[0] < 0 && b.center[2] === 3.02)!
    const p = local(f.position)
    for (let i = 0; i < 3; i++) expect(inside(pew, { x: p.x + i * 0.35, z: p.z })).toBe(true)
  })

  it('the revolver on the cupboard shelf, inside the cupboard', () => {
    expect(gap(CHAPEL_CUPBOARD_POSITION[1], CHAPEL_SURFACES.cupboardShelfY)).toBeLessThanOrEqual(0.03)
    const cupboard = CHAPEL_INTERIOR_BOXES.find((b) => b.note === 'vestry cupboard')!
    expect(inside(cupboard, local(CHAPEL_CUPBOARD_POSITION))).toBe(true)
    // The model lies on the surface: its centre is lifted by half its height, no more.
    const pose = groundPose('revolver', 1.5)
    expect(pose.lift).toBeGreaterThan(0)
    expect(pose.lift).toBeLessThan(0.1)
    expect(itemSizeM('revolver')).not.toBeNull()
    expect(ITEM_MAP.revolver.model).toBeTruthy()
  })
})

describe('the hymn board', () => {
  it('reads 4 · 19 · 2 · 41 · 23 (docs/case-design.md §3) and hangs on the east wall facing west', () => {
    expect(HYMN_BOARD_NUMBERS).toEqual([4, 19, 2, 41, 23])
    expect(HYMN_BOARD_POSITION).toEqual([12.47, 1.75, 8.7])
    // East wall inner face is at chapel-local x 2.5 - 0.15.
    expect(HYMN_BOARD_POSITION[0] - CHAPEL_CENTER[0]).toBeGreaterThan(2.3)
  })
})

describe('zombies still reach the altar and the vestry with the pews in', () => {
  const DT = 1 / 60
  const blocked = makeBlocked([...structureBoxes(), ...propBoxes()])

  function walkTo(from: { x: number; z: number }, to: { x: number; z: number }): number | null {
    let zs: AIEnemy[] = [createEnemy('t', 'shambler', from)]
    const ctx = { playerPos: to, playerFacing: { x: 0, z: -1 }, lanternFuel: 100, blocked }
    for (let i = 0; i < 120 / DT; i++) {
      zs = tickEnemies(zs, DT, ctx).enemies
      if (Math.hypot(zs[0].pos.x - to.x, zs[0].pos.z - to.z) <= ENEMY_MAP.shambler.attackRange) return i * DT
    }
    return null
  }

  it.each([
    ['the altar (10, 9.2)', { x: 10, z: 9.2 }],
    ['the vestry inside (8.2, 9.5)', { x: 8.2, z: 9.5 }],
    ['the lectern (10, 5)', { x: 10, z: 5 }],
  ])('from every wave grave to %s', (_name, player) => {
    for (const g of WAVE_GRAVES) expect(walkTo(g, player), g.id).not.toBeNull()
  })
})
