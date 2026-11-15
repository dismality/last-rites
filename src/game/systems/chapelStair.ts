// The catacomb stair under the chapel floor (spec 09 task 11n-e): where the floor opens, the ramp
// and shaft-wall colliders that let the player walk down the steps, the hole in the y = 0 physics
// floor, and the altar's slide toward the door when the stair opens. Pure; numbers come from
// data/chapelScenery.ts (the Blender generator's values).

import { ALTAR_SLIDE, CHAPEL_STAIR, type ChapelBox } from '../../data/chapelScenery'
import type { Vec3 } from '../../data/cemeteryLayout'

/** An axis-aligned rectangle on the ground plane. */
export interface GroundRect {
  readonly xMin: number
  readonly xMax: number
  readonly zMin: number
  readonly zMax: number
}

/** A collider box that may be tilted about X (the ramp). */
export interface TiltedBox {
  readonly center: Vec3
  readonly half: Vec3
  /** Rotation about X, radians: positive tips +z downward. */
  readonly rotX: number
  readonly note: string
}

/** The floor opening, chapel-local. */
export function stairOpening(s: typeof CHAPEL_STAIR = CHAPEL_STAIR): GroundRect {
  return { xMin: s.x0, xMax: s.x1, zMin: s.z0, zMax: s.innerBackZ }
}

/** The opening moved into world space by the chapel centre. */
export function stairOpeningWorld(center: Vec3, s: typeof CHAPEL_STAIR = CHAPEL_STAIR): GroundRect {
  const r = stairOpening(s)
  return { xMin: r.xMin + center[0], xMax: r.xMax + center[0], zMin: r.zMin + center[2], zMax: r.zMax + center[2] }
}

/** Slope of the steps: the angle below horizontal, radians. */
export function stairAngle(s: typeof CHAPEL_STAIR = CHAPEL_STAIR): number {
  return Math.atan2(s.rise, s.run)
}

/** Height of the step nosings' line at chapel-local z (0 at the top edge, falling toward +z). */
export function stairSurfaceY(z: number, s: typeof CHAPEL_STAIR = CHAPEL_STAIR): number {
  const d = Math.min(Math.max(z - s.z0, 0), s.run * s.steps)
  return -d * Math.tan(stairAngle(s))
}

/**
 * The walkable stair: one ramp along the step nosings, from the top edge to past the end wall (the
 * wall collider stops the player where the vault comes down), and a shaft wall either side.
 * Chapel-local. The ramp's top face passes through (z0, 0) with the steps' slope.
 */
export function stairColliders(s: typeof CHAPEL_STAIR = CHAPEL_STAIR): { ramp: TiltedBox; walls: ChapelBox[] } {
  const a = stairAngle(s)
  const thick = s.wallThickness / 2
  // Along the slope from the top edge to one wall-thickness past the inner back face.
  const runLength = s.innerBackZ - s.z0 + s.wallThickness * 2
  const length = runLength / Math.cos(a)
  const dir = [0, -Math.sin(a), Math.cos(a)] as const
  const normal = [0, Math.cos(a), Math.sin(a)] as const
  const top = [0, dir[1] * (length / 2), s.z0 + dir[2] * (length / 2)] as const
  const ramp: TiltedBox = {
    center: [(s.x0 + s.x1) / 2, top[1] - normal[1] * thick, top[2] - normal[2] * thick],
    half: [(s.x1 - s.x0) / 2, thick, length / 2],
    rotX: a,
    note: 'stair ramp',
  }
  const depth = -stairSurfaceY(s.innerBackZ, s) + s.wallThickness * 2
  const wallZ = (s.z0 + s.innerBackZ) / 2
  const wallHalfZ = (s.innerBackZ - s.z0) / 2
  const walls: ChapelBox[] = [s.x0 - thick, s.x1 + thick].map((x) => ({
    center: [x, -depth / 2, wallZ] as Vec3,
    half: [thick, depth / 2, wallHalfZ] as Vec3,
    rotY: 0,
    note: 'stair shaft wall',
  }))
  return { ramp, walls }
}

/**
 * The outer ground rectangle with `hole` cut out, as up to four rectangles (west, east, then the
 * strips north and south of the hole). A hole outside the rectangle leaves it whole.
 */
export function splitAroundHole(outer: GroundRect, hole: GroundRect): GroundRect[] {
  const h = {
    xMin: Math.max(outer.xMin, hole.xMin),
    xMax: Math.min(outer.xMax, hole.xMax),
    zMin: Math.max(outer.zMin, hole.zMin),
    zMax: Math.min(outer.zMax, hole.zMax),
  }
  if (h.xMin >= h.xMax || h.zMin >= h.zMax) return [outer]
  const parts: GroundRect[] = [
    { xMin: outer.xMin, xMax: h.xMin, zMin: outer.zMin, zMax: outer.zMax },
    { xMin: h.xMax, xMax: outer.xMax, zMin: outer.zMin, zMax: outer.zMax },
    { xMin: h.xMin, xMax: h.xMax, zMin: outer.zMin, zMax: h.zMin },
    { xMin: h.xMin, xMax: h.xMax, zMin: h.zMax, zMax: outer.zMax },
  ]
  return parts.filter((p) => p.xMax > p.xMin && p.zMax > p.zMin)
}

/** How far the altar has slid (negative z, metres) `t` seconds after the stair opened. Ease-out. */
export function altarSlideOffset(t: number, slide: typeof ALTAR_SLIDE = ALTAR_SLIDE): number {
  if (t <= 0) return 0
  const k = Math.min(t / slide.seconds, 1)
  return -slide.distance * (1 - (1 - k) * (1 - k))
}

/** The altar's offset once the slide is over (the stair already open on load, or after 2 s). */
export function altarRestOffset(stairOpen: boolean, slide: typeof ALTAR_SLIDE = ALTAR_SLIDE): number {
  return stairOpen ? -slide.distance : 0
}