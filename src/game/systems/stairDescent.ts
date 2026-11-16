// Walking down the chapel stair to the catacombs (spec 09 task 11n-f). Pure: the descent trigger,
// the fade timeline, where the player arrives, the altar push that keeps the sliding altar off the
// player, the nearest-free-spot safety net, and the guidance redirect. The scene (ChapelBuilding,
// StairDescent) only wires these to Rapier and the screen.

import { CATACOMBS, CHAPEL_CENTER, type Vec3 } from '../../data/cemeteryLayout'
import { STAIR_DESCENT, STAIR_DESCENT_TIMING, STAIR_RULES, type ChapelBox } from '../../data/chapelScenery'
import { stairOpeningWorld, stairSurfaceY } from './chapelStair'

/** Player capsule radius (FirstPersonController). */
export const PLAYER_RADIUS = 0.35
/**
 * Overlap tests use a slightly smaller radius than the capsule: the character controller keeps a
 * 1 cm skin, so a player merely touching a wall must not count as overlapping it.
 */
const OVERLAP_RADIUS = PLAYER_RADIUS - STAIR_RULES.radiusSlack

/** Where the player arrives: inside the catacomb corridor, 1.1 m past the gate wall, facing +z. */
export const DESCENT_ARRIVAL = {
  position: [CATACOMBS.centerX, STAIR_RULES.arrivalFeetY, CATACOMBS.entranceZ + STAIR_RULES.arrivalInset] as Vec3,
  /** Yaw 0 faces -z; PI faces +z, down the corridor. */
  yaw: Math.PI,
} as const

/** The point guidance sends the player to once the stair is open: the top of the steps (world). */
export const STAIR_GUIDE_POINT: Vec3 = [CHAPEL_CENTER[0], 0, CHAPEL_CENTER[2] + 4.9]

export interface WorldBox {
  readonly min: Vec3
  readonly max: Vec3
}

/** The descent trigger in world space. */
export function descentTriggerWorld(center: Vec3 = CHAPEL_CENTER): WorldBox {
  const t = STAIR_DESCENT
  return {
    min: [t.x0 + center[0], t.yMin + center[1], t.z0 + center[2]],
    max: [t.x1 + center[0], t.yMax + center[1], t.z1 + center[2]],
  }
}

/**
 * True when the player's feet (world) are inside the descent trigger: within the box in x and z,
 * on the steps, and where the steps' surface lies in the box's y range (below -0.5).
 */
export function inDescentTrigger(feet: Vec3, center: Vec3 = CHAPEL_CENTER): boolean {
  const b = descentTriggerWorld(center)
  const surfaceY = stairSurfaceY(feet[2] - center[2]) + center[1]
  return (
    feet[0] >= b.min[0] && feet[0] <= b.max[0] &&
    feet[2] >= b.min[2] && feet[2] <= b.max[2] &&
    feet[1] - center[1] < STAIR_RULES.onStepsBelowY &&
    surfaceY >= b.min[1] && surfaceY <= b.max[1]
  )
}

export interface DescentFrame {
  /** Black overlay opacity, 0..1. */
  readonly opacity: number
  /** True while the screen is fully black: input is locked only now. */
  readonly black: boolean
  /** True from the moment the screen is black: the player has been moved. */
  readonly moved: boolean
  readonly done: boolean
}

/** The descent `t` seconds after the trigger fired. */
export function descentFrame(t: number, timing: typeof STAIR_DESCENT_TIMING = STAIR_DESCENT_TIMING): DescentFrame {
  const { fadeOut, black, fadeIn } = timing
  const clamp = (v: number) => Math.min(1, Math.max(0, v))
  if (t < fadeOut) return { opacity: clamp(t / fadeOut), black: false, moved: false, done: false }
  if (t < fadeOut + black) return { opacity: 1, black: true, moved: true, done: false }
  const k = (t - fadeOut - black) / fadeIn
  return { opacity: clamp(1 - k), black: false, moved: true, done: t >= fadeOut + black + fadeIn }
}

/**
 * A feet position that sits inside the stair shaft (below the floor within the opening) is not
 * somewhere a loaded game may put the player: the shaft ends in a wall and a black vault. Such a
 * position becomes the catacomb arrival point; any other is returned unchanged.
 */
export function sanitizeStairPosition(
  position: readonly [number, number, number],
  yaw: number,
  center: Vec3 = CHAPEL_CENTER,
): { position: [number, number, number]; yaw: number; moved: boolean } {
  const r = stairOpeningWorld(center)
  const inShaft =
    position[1] < STAIR_RULES.shaftBelowY && position[0] >= r.xMin && position[0] <= r.xMax && position[2] >= r.zMin && position[2] <= r.zMax
  if (!inShaft) return { position: [position[0], position[1], position[2]], yaw, moved: false }
  return { position: [...DESCENT_ARRIVAL.position], yaw: DESCENT_ARRIVAL.yaw, moved: true }
}

/** Distance from (x, z) to an axis-aligned chapel box's footprint; 0 inside it. */
export function distanceToBox(x: number, z: number, b: ChapelBox): number {
  const dx = Math.max(Math.abs(x - b.center[0]) - b.half[0], 0)
  const dz = Math.max(Math.abs(z - b.center[2]) - b.half[2], 0)
  return Math.hypot(dx, dz)
}

/** True when a circle of `radius` at (x, z) overlaps the box's footprint. */
export function circleHitsBox(x: number, z: number, b: ChapelBox, radius = OVERLAP_RADIUS): boolean {
  return distanceToBox(x, z, b) < radius
}

/**
 * The z shift (metres, chapel-local) that keeps a player circle out of the sliding altar. The
 * altar moves toward -z, so a player in front of it is pushed ahead of it; one that somehow stands
 * behind it is pushed the other way. 0 when there is no overlap.
 */
export function altarPushOut(x: number, z: number, altar: ChapelBox, radius = PLAYER_RADIUS): number {
  if (!circleHitsBox(x, z, altar, radius - STAIR_RULES.radiusSlack)) return 0
  const front = altar.center[2] - altar.half[2] - radius
  const back = altar.center[2] + altar.half[2] + radius
  return z < altar.center[2] ? front - z : back - z
}

/** The altar box moved by the slide offset `off` (0 sealed, -0.6 slid), from the rest-state box. */
export function altarAt(rest: ChapelBox, off: number): ChapelBox {
  return { ...rest, center: [rest.center[0], rest.center[1], rest.center[2] + off] }
}

export interface FreeSpotArea {
  readonly xMin: number
  readonly xMax: number
  readonly zMin: number
  readonly zMax: number
}

/** The nave, chapel-local: inside the walls, short of the stair opening. */
export const NAVE_AREA: FreeSpotArea = { xMin: -2.1, xMax: 2.1, zMin: -5.6, zMax: 4.7 }

/**
 * The nearest point to (x, z) where a circle clears every box (grid search, 5 cm steps), inside
 * `area`. Null when there is none. The safety net after the altar slide.
 */
export function nearestFreePoint(
  x: number,
  z: number,
  boxes: readonly ChapelBox[],
  area: FreeSpotArea = NAVE_AREA,
  radius = PLAYER_RADIUS,
): { x: number; z: number } | null {
  let best: { x: number; z: number } | null = null
  let bestD = Infinity
  const step = STAIR_RULES.searchStep
  for (let px = area.xMin; px <= area.xMax + 1e-9; px += step) {
    for (let pz = area.zMin; pz <= area.zMax + 1e-9; pz += step) {
      if (boxes.some((b) => distanceToBox(px, pz, b) < radius)) continue
      const d = Math.hypot(px - x, pz - z)
      if (d < bestD) {
        bestD = d
        best = { x: px, z: pz }
      }
    }
  }
  return best
}

/** True when the 2D point lies in the corridor of the catacombs (outside the chapel). */
export function inCatacombCorridor(x: number, z: number): boolean {
  return (
    Math.abs(x - CATACOMBS.centerX) < CATACOMBS.width / 2 &&
    z > CATACOMBS.entranceZ &&
    z < CATACOMBS.entranceZ + CATACOMBS.length
  )
}

/**
 * Guidance: once the stair is open, an objective that lies in the catacombs sends a player who is
 * not yet there to the chapel stair, the way in (the corridor gate is only the way out).
 */
export function redirectViaStair(
  target: Vec3 | undefined,
  playerPos: Vec3,
  stairOpen: boolean,
): Vec3 | undefined {
  if (!target || !stairOpen) return target
  if (!inCatacombCorridor(target[0], target[2])) return target
  if (inCatacombCorridor(playerPos[0], playerPos[2])) return target
  return STAIR_GUIDE_POINT
}
