import { describe, it, expect } from 'vitest'
import {
  CHAPEL,
  CHAPEL_BUTTRESS_HALF_W,
  CHAPEL_BUTTRESS_Z,
  CHAPEL_CENTER,
  CHAPEL_CUPBOARD_POSITION,
  CHAPEL_DOORS,
  CHAPEL_WINDOW_HALF_W,
  CHAPEL_WINDOW_Z,
  CONGREGATION_POINTS,
  CRANE_CRYPT_STEP,
  CRANE_SPAWN,
  LODGE,
  POWDER_TIN_BELL_TOWER,
  POWDER_TIN_HUT,
  WOODPILE_POSITION,
  AVENUE_CRYPT_SIZE,
  avenueCrypts,
} from './cemeteryLayout'
import { WEAPON_PICKUPS } from './weaponPickups'
import { WAVE_GRAVES } from './waves'
import { WAYPOINT_EDGES, WAYPOINT_NODES } from './waypoints'
import { DEFAULT_GRAPH, findPath, nearestNode } from '../game/systems/navigation'

describe('bible placements', () => {
  it('doors', () => {
    expect(CHAPEL_DOORS.front.point).toEqual([10, 0, -1])
    expect(CHAPEL_DOORS.front.standPoint).toEqual([10, 0, -2])
    expect(CHAPEL_DOORS.vestry.point).toEqual([7.5, 0, 9.5])
    expect(CHAPEL_DOORS.vestry.standPoint).toEqual([6.5, 0, 9.5])
    expect(CHAPEL_DOORS.vestry.width).toBe(1.4)
    for (const d of Object.values(CHAPEL_DOORS)) {
      expect(Math.hypot(d.outward[0], d.outward[2])).toBeCloseTo(1)
    }
  })
  it('items and spawns', () => {
    expect(LODGE.center).toEqual([-23.8, 0, -41.5])
    expect(LODGE.pickupRadius).toBe(0.9)
    expect(WOODPILE_POSITION).toEqual([-5, 0, 2])
    expect(CHAPEL_CUPBOARD_POSITION).toEqual([7.9, 0.9, 7.6])
    expect(CRANE_CRYPT_STEP).toEqual([-18.9, 0.35, -59.3])
    expect(POWDER_TIN_HUT).toEqual([-1.8, 0.8, -1])
    expect(POWDER_TIN_BELL_TOWER).toEqual([29, 0.4, -24])
    expect(CRANE_SPAWN.stair).toEqual([10, 0, 10.3])
    expect(CRANE_SPAWN.floorBreak).toEqual([11.7, 0, 9.6])
    expect(CONGREGATION_POINTS).toEqual([
      [9, 0, 3],
      [11, 0, 3],
      [10, 0, 1.5],
    ])
  })
  it('weapon pickups sit at the placements', () => {
    const at = (id: string) => WEAPON_PICKUPS.find((p) => p.id === id)!.position
    expect(at('revolver')).toEqual(CHAPEL_CUPBOARD_POSITION)
    expect(at('shotgun')).toEqual(LODGE.center)
    expect(at('wood-axe')).toEqual(WOODPILE_POSITION)
    expect(at('silver-sabre')).toEqual(CRANE_CRYPT_STEP)
    expect(WEAPON_PICKUPS).toHaveLength(4)
  })
})

describe('layout clearances', () => {
  it('the lodge does not overlap the avenue crypts', () => {
    const [lx, , lz] = LODGE.center
    for (const c of avenueCrypts()) {
      const { width, depth } = AVENUE_CRYPT_SIZE[c.model]
      // Crypts are turned a quarter turn: depth runs along X, width along Z.
      const hx = depth / 2
      const hz = width / 2
      const overlapX = Math.abs(lx - c.position[0]) < LODGE.halfX + hx
      const overlapZ = Math.abs(lz - c.position[2]) < LODGE.halfZ + hz
      expect(overlapX && overlapZ).toBe(false)
    }
  })

  it('the vestry opening clears the buttresses and windows', () => {
    const half = CHAPEL_DOORS.vestry.width / 2
    const z = CHAPEL_DOORS.vestry.point[2] - CHAPEL_CENTER[2]
    expect(z - half).toBeGreaterThanOrEqual(-CHAPEL.halfZ)
    expect(z + half).toBeLessThanOrEqual(CHAPEL.halfZ)
    for (const b of CHAPEL_BUTTRESS_Z) {
      expect(Math.abs(b - z)).toBeGreaterThanOrEqual(half + CHAPEL_BUTTRESS_HALF_W)
    }
    for (const w of CHAPEL_WINDOW_Z) {
      expect(Math.abs(w - z)).toBeGreaterThanOrEqual(half + CHAPEL_WINDOW_HALF_W)
    }
  })
})

describe('door waypoints', () => {
  it('chapel-vestry links hut and grounds-south', () => {
    expect(WAYPOINT_NODES.find((n) => n.id === 'chapel-vestry')).toMatchObject({ x: 5.5, z: 9.5 })
    const has = (a: string, b: string) =>
      WAYPOINT_EDGES.some(([x, y]) => (x === a && y === b) || (x === b && y === a))
    expect(has('chapel-vestry', 'hut')).toBe(true)
    expect(has('chapel-vestry', 'grounds-south')).toBe(true)
  })

  it('both stand points are reachable from every spawn grave', () => {
    for (const door of Object.values(CHAPEL_DOORS)) {
      const goal = nearestNode(DEFAULT_GRAPH, { x: door.standPoint[0], z: door.standPoint[2] })!
      for (const g of WAVE_GRAVES) {
        const start = nearestNode(DEFAULT_GRAPH, { x: g.x, z: g.z })!
        expect(findPath(DEFAULT_GRAPH, start, goal), `${g.id} -> ${door.id}`).not.toBeNull()
      }
    }
  })
})
