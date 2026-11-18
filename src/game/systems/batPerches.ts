// Where the bats sit (spec 11 H4). Pure TypeScript: no React, three.js or Howler imports.
import { BAT } from '../../data/bats'
import { createRng, randInt } from '../rng'

/** A collider box as stored in graveyard-colliders.json: centre and half extents (m). */
export interface PerchBox {
  center: readonly [number, number, number]
  half: readonly [number, number, number]
  /** Yaw of the box (rad); absent means axis-aligned. */
  rotY?: number
}

export interface PerchSpot {
  /** Index into the box list given to `choosePerches`. */
  boxIndex: number
  /** Top-face centre of the box. */
  position: readonly [number, number, number]
}

/** Height of the top face above the ground; this is what a bat sits on. */
export function topHeight(b: PerchBox): number {
  return b.center[1] + b.half[1]
}

export function isQualifying(b: PerchBox): boolean {
  const h = topHeight(b)
  return h >= BAT.boxHeightMinM && h <= BAT.boxHeightMaxM
}

/** True when point (x, z) lies inside the box footprint, rotation included. */
function footprintContains(b: PerchBox, x: number, z: number): boolean {
  const dx = x - b.center[0]
  const dz = z - b.center[2]
  const c = Math.cos(b.rotY ?? 0)
  const s = Math.sin(b.rotY ?? 0)
  const lx = dx * c - dz * s
  const lz = dx * s + dz * c
  return Math.abs(lx) <= b.half[0] && Math.abs(lz) <= b.half[2]
}

/**
 * True when another, raised box (a cross shaft on its plinth) stands over this box's top face
 * within the bat's headroom. A bat there would sit inside the stone. Boxes that start at the
 * same level are neighbours or overlaps, not stone above, so they do not count.
 */
export function hasStoneAbove(b: PerchBox, boxes: readonly PerchBox[]): boolean {
  const top = topHeight(b)
  const bottom = b.center[1] - b.half[1]
  return boxes.some(
    (o) =>
      o !== b &&
      o.center[1] - o.half[1] > bottom &&
      o.center[1] - o.half[1] < top + BAT.headroomM &&
      topHeight(o) > top &&
      footprintContains(o, b.center[0], b.center[2]),
  )
}

/** Indices of the boxes a bat may perch on. */
export function qualifyingBoxes(boxes: readonly PerchBox[]): number[] {
  const out: number[] = []
  boxes.forEach((b, i) => {
    if (isQualifying(b) && !hasStoneAbove(b, boxes)) out.push(i)
  })
  return out
}

export function perchPosition(b: PerchBox): readonly [number, number, number] {
  return [b.center[0], topHeight(b), b.center[2]]
}

/**
 * Picks min(n, qualifying) distinct free boxes, n in [perchedMin, perchedMax]. `occupied` boxes
 * (and `exclude`, for a returning bat's old box) are never chosen.
 */
export function choosePerches(
  boxes: readonly PerchBox[],
  seed: number,
  occupied: readonly number[] = [],
  exclude: readonly number[] = [],
): PerchSpot[] {
  const rng = createRng(seed)
  const taken = new Set([...occupied, ...exclude])
  const pool = qualifyingBoxes(boxes).filter((i) => !taken.has(i))
  const n = Math.min(randInt(rng, BAT.perchedMin, BAT.perchedMax), pool.length)
  // Partial Fisher-Yates: the first n entries are a uniform sample without repeats.
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rng() * (pool.length - i))
    const tmp = pool[i]
    pool[i] = pool[j]
    pool[j] = tmp
  }
  return pool
    .slice(0, n)
    .map((boxIndex) => ({ boxIndex, position: perchPosition(boxes[boxIndex]) }))
}
