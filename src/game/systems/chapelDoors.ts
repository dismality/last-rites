// Pure chapel door rules (Req 16): which doors are closed, where zombies may stand and what they target.
import { CHAPEL, CHAPEL_CENTER, CHAPEL_DOORS } from '../../data/cemeteryLayout'
import type { DoorId } from '../types'
import type { BarricadeState } from './barricade'
import type { Vec2 } from './combat'
import type { AIState } from './enemyAI'
import type { SegmentBlocked } from './navigation'
import { isBarricadeBuilt, type ChapelState } from './repairs'

export interface DoorGeom {
  id: DoorId
  /** Centre of the opening on the wall line. */
  pos: Vec2
  /** Unit vector pointing out of the chapel. */
  outward: Vec2
  widthM: number
  standPoint: Vec2
}

const DOOR_IDS: readonly DoorId[] = ['front', 'vestry']

const geom = (id: DoorId): DoorGeom => {
  const d = CHAPEL_DOORS[id]
  return {
    id,
    pos: { x: d.point[0], z: d.point[2] },
    outward: { x: d.outward[0], z: d.outward[2] },
    widthM: d.width,
    standPoint: { x: d.standPoint[0], z: d.standPoint[2] },
  }
}

export const CHAPEL_DOOR_GEOM: Readonly<Record<DoorId, DoorGeom>> = {
  front: geom('front'),
  vestry: geom('vestry'),
}

/** Half the depth of the doorway slab a closed door fills, across the wall (m). */
const DOORWAY_HALF_DEPTH_M = CHAPEL.wallThickness
/** Ejected zombies land this far clear of the slab. */
const EJECT_MARGIN_M = 0.05

/** Inside the chapel walls. */
export const insideChapel = (p: Vec2): boolean =>
  Math.abs(p.x - CHAPEL_CENTER[0]) <= CHAPEL.halfX && Math.abs(p.z - CHAPEL_CENTER[2]) <= CHAPEL.halfZ

/** The door store's `built` flag only counts while repair stage 1 is in the chapel state. */
export const barricadeFor = (chapel: ChapelState, doors: BarricadeState): BarricadeState =>
  doors.built && !isBarricadeBuilt(chapel) ? { ...doors, built: false } : doors

/** Closed iff the barricade is built and the door has at least 1 board. */
export const doorClosed = (s: BarricadeState, id: DoorId): boolean => s.built && s.doors[id].length > 0

/** Safe zone: both doors closed. */
export const chapelSafe = (s: BarricadeState): boolean => doorClosed(s, 'front') && doorClosed(s, 'vestry')

/** Tangent along the wall, and the signed offsets of a point from a door's centre. */
const local = (g: DoorGeom, p: Vec2): { along: number; across: number } => {
  const dx = p.x - g.pos.x
  const dz = p.z - g.pos.z
  return { along: dx * -g.outward.z + dz * g.outward.x, across: dx * g.outward.x + dz * g.outward.z }
}

/** A segment is blocked when it crosses the opening of a closed door. */
export const closedDoorBlocks =
  (closed: Record<DoorId, boolean>): SegmentBlocked =>
  (a, b) =>
    DOOR_IDS.some((id) => {
      if (!closed[id]) return false
      const g = CHAPEL_DOOR_GEOM[id]
      const pa = local(g, a)
      const pb = local(g, b)
      // Crossing the wall plane (a segment that ends exactly on it counts as touching).
      if ((pa.across > 0 && pb.across > 0) || (pa.across < 0 && pb.across < 0)) return false
      if (pa.across === pb.across) return Math.abs(pa.along) <= g.widthM / 2 || Math.abs(pb.along) <= g.widthM / 2
      const t = pa.across / (pa.across - pb.across)
      return Math.abs(pa.along + (pb.along - pa.along) * t) <= g.widthM / 2
    })

/** Moves any zombie standing in a closed doorway to the nearer side, just clear of the slab. */
export function ejectFromClosedDoors<T extends { pos: Vec2; state: AIState }>(
  enemies: readonly T[],
  closed: Record<DoorId, boolean>,
): readonly T[] {
  return enemies.map((e) => {
    for (const id of DOOR_IDS) {
      if (!closed[id]) continue
      const g = CHAPEL_DOOR_GEOM[id]
      const { along, across } = local(g, e.pos)
      if (Math.abs(along) > g.widthM / 2 || Math.abs(across) > DOORWAY_HALF_DEPTH_M) continue
      const side = across < 0 ? -1 : 1
      const target = side * (DOORWAY_HALF_DEPTH_M + EJECT_MARGIN_M)
      const d = target - across
      return { ...e, pos: { x: e.pos.x + g.outward.x * d, z: e.pos.z + g.outward.z * d } }
    }
    return e
  })
}

const nearestOpenDoor = (s: BarricadeState, p: Vec2): DoorId | null => {
  let best: DoorId | null = null
  let bestD = Infinity
  for (const id of DOOR_IDS) {
    if (s.doors[id].length === 0) continue
    const g = CHAPEL_DOOR_GEOM[id]
    const d = Math.hypot(g.pos.x - p.x, g.pos.z - p.z)
    if (d < bestD) {
      bestD = d
      best = id
    }
  }
  return best
}

/**
 * Night with the player inside: every zombie goes for the nearest door that still has boards.
 * Player outside: only a Door_Attacker does. No barricade, or day: the player.
 */
export function chooseTarget(
  e: { doorAttacker: boolean; pos: Vec2 },
  c: { barricade: BarricadeState; playerInside: boolean; night: boolean },
): 'player' | DoorId {
  if (!c.barricade.built || !c.night) return 'player'
  if (!c.playerInside && !e.doorAttacker) return 'player'
  return nearestOpenDoor(c.barricade, e.pos) ?? 'player'
}
