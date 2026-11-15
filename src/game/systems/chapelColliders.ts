// The chapel's collision boxes: the Blender scene's boxes, shortened where they would block the
// way. Pure and axis-aligned (every chapel box has rotY 0). Spec 09 task 11n-a: "none of them may
// block the centre aisle, either door, the altar trigger or the congregation points; if a pew
// blocks a path, shorten its collider, don't move the pew."

import {
  CHAPEL_BUTTRESS_TRIMS,
  CHAPEL_EXTERIOR_BOXES,
  CHAPEL_INTERIOR_BOXES,
  type ChapelBox,
} from '../../data/chapelScenery'

/** The walkway down the middle of the nave, chapel-local: |x| < halfWidth, z from the door to the altar trigger. */
export interface Aisle {
  readonly halfWidth: number
  readonly zMin: number
  readonly zMax: number
}

/** x 9.3..10.7, z -1..9.5 in the world (chapel centre [10, 0, 5]). */
export const CHAPEL_AISLE: Aisle = { halfWidth: 0.7, zMin: -6, zMax: 4.5 }

interface Rect {
  xMin: number
  xMax: number
  zMin: number
  zMax: number
}

const rectOf = (b: ChapelBox): Rect => ({
  xMin: b.center[0] - b.half[0],
  xMax: b.center[0] + b.half[0],
  zMin: b.center[2] - b.half[2],
  zMax: b.center[2] + b.half[2],
})

function withRect(b: ChapelBox, r: Rect): ChapelBox {
  return {
    ...b,
    center: [(r.xMin + r.xMax) / 2, b.center[1], (r.zMin + r.zMax) / 2],
    half: [(r.xMax - r.xMin) / 2, b.half[1], (r.zMax - r.zMin) / 2],
  }
}

const area = (r: Rect): number => Math.max(0, r.xMax - r.xMin) * Math.max(0, r.zMax - r.zMin)

/** True when the box's footprint overlaps the aisle by more than a hair. */
export function crossesAisle(b: ChapelBox, aisle: Aisle = CHAPEL_AISLE): boolean {
  const r = rectOf(b)
  return (
    r.xMin < aisle.halfWidth - 1e-6 &&
    r.xMax > -aisle.halfWidth + 1e-6 &&
    r.zMin < aisle.zMax - 1e-6 &&
    r.zMax > aisle.zMin + 1e-6
  )
}

/**
 * One box with the aisle cut out of it. Tries the two single-cut shortenings (pull the inner edge
 * out of the aisle sideways, or pull the front edge back to the altar trigger) and keeps the one
 * that leaves more of the box. A box with no single cut that clears the aisle (the lectern, which
 * stands in its middle) is dropped; null says so.
 */
export function clearAisle(b: ChapelBox, aisle: Aisle = CHAPEL_AISLE): ChapelBox | null {
  if (!crossesAisle(b, aisle)) return b
  const r = rectOf(b)
  const options: Rect[] = []
  // Sideways: only when the box sits on one side of the centre line.
  if (b.center[0] > 0 && r.xMax > aisle.halfWidth) options.push({ ...r, xMin: aisle.halfWidth })
  if (b.center[0] < 0 && r.xMin < -aisle.halfWidth) options.push({ ...r, xMax: -aisle.halfWidth })
  // Lengthways: a box at the far end (the altar) gives up the part inside the aisle's z range.
  if (r.zMin < aisle.zMax && r.zMax > aisle.zMax) options.push({ ...r, zMin: aisle.zMax })
  const best = options.sort((a, c) => area(c) - area(a))[0]
  return best && area(best) > 0 ? withRect(b, best) : null
}

/** The scene's boxes with every one shortened to leave the aisle clear. */
export function clearedColliders(
  boxes: readonly ChapelBox[],
  aisle: Aisle = CHAPEL_AISLE,
): ChapelBox[] {
  return boxes.flatMap((b) => {
    const cleared = clearAisle(b, aisle)
    return cleared ? [cleared] : []
  })
}

/** Boxes the scene dropped whole (they stand in the aisle). */
export function droppedColliders(
  boxes: readonly ChapelBox[],
  aisle: Aisle = CHAPEL_AISLE,
): ChapelBox[] {
  return boxes.filter((b) => crossesAisle(b, aisle) && clearAisle(b, aisle) === null)
}

/** A buttress with its outer face pulled in to `outerX` (chapel-local); the wall-side face stays. */
export function trimOuter(b: ChapelBox, outerX: number): ChapelBox {
  const r = rectOf(b)
  return b.center[0] < 0 ? withRect(b, { ...r, xMin: Math.max(r.xMin, outerX) }) : withRect(b, { ...r, xMax: Math.min(r.xMax, outerX) })
}

/** The buttress boxes with the navigation trims of CHAPEL_BUTTRESS_TRIMS applied. */
export function trimmedButtresses(
  boxes: readonly ChapelBox[] = CHAPEL_EXTERIOR_BOXES,
  trims: typeof CHAPEL_BUTTRESS_TRIMS = CHAPEL_BUTTRESS_TRIMS,
): ChapelBox[] {
  return boxes.map((b) => {
    const t = trims.find((tr) => Math.abs(tr.x - b.center[0]) < 1e-6 && Math.abs(tr.z - b.center[2]) < 1e-6)
    return t ? trimOuter(b, t.outerX) : b
  })
}

/** The altar box moved along z by `dz` (the slide when the stair opens); other boxes unchanged. */
export function shiftAltar(boxes: readonly ChapelBox[], dz: number): ChapelBox[] {
  return boxes.map((b) =>
    b.note === 'altar' ? { ...b, center: [b.center[0], b.center[1], b.center[2] + dz] } : b,
  )
}

/**
 * Every collider the chapel scene adds to the walls: cleared interior boxes plus the buttresses.
 * `altarDz` is the altar's slide (0 while the stair is sealed); the aisle then ends that much
 * nearer the door too, because the altar trigger moves with the altar.
 */
export function chapelSceneColliders(altarDz = 0): ChapelBox[] {
  const aisle: Aisle = { ...CHAPEL_AISLE, zMax: CHAPEL_AISLE.zMax + altarDz }
  return [...clearedColliders(shiftAltar(CHAPEL_INTERIOR_BOXES, altarDz), aisle), ...trimmedButtresses()]
}
