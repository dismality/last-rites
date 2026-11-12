// The real cemetery's walls as axis-aligned boxes, built only from src/data, plus a segment probe
// that mirrors scene/enemies/wallProbe.ts (knee-high ray, stops 0.5 m short of its end).
// Mirrors the colliders in Hut.tsx, ChapelBuilding.tsx and Cemetery.tsx; keep them in step.
import {
  CHAPEL,
  CHAPEL_CENTER,
  CHAPEL_DOORS,
  CORRIDORS,
  GROUNDS_HALF,
  HUT,
  LAMP_POSTS,
} from '../../src/data/cemeteryLayout'
import { headstoneCollider, headstoneScale, lampCollider } from '../../src/data/colliderFootprints'
import { GRAVEYARD_COLLIDERS } from '../../src/data/graveyardColliders'
import { TOMBSTONES } from '../../src/data/tombstones'
import type { Vec2 } from '../../src/game/systems/combat'

export interface Box {
  cx: number
  cz: number
  hx: number
  hz: number
}

const box = (cx: number, cz: number, hx: number, hz: number): Box => ({ cx, cz, hx, hz })

/** Hut, chapel and catacomb corridor walls: the big structures (fences and crypts are graveyard boxes). */
export function structureBoxes(): Box[] {
  const out: Box[] = []
  const { halfX, halfZ, wallThickness: ht, doorWidth } = HUT
  const frontW = halfX - doorWidth / 2
  const frontX = doorWidth / 2 + frontW / 2
  out.push(
    box(0, -halfZ, halfX + ht / 2, ht / 2),
    box(-halfX, 0, ht / 2, halfZ),
    box(halfX, 0, ht / 2, halfZ),
    box(-frontX, halfZ, frontW / 2, ht / 2),
    box(frontX, halfZ, frontW / 2, ht / 2),
    box(2.1, -1.1, 0.8, 0.4), // table
  )

  const [cx, , cz] = CHAPEL_CENTER
  const { halfX: chx, halfZ: chz, wallThickness: ct } = CHAPEL
  const sideW = chx - CHAPEL.doorWidth / 2
  const sideX = CHAPEL.doorWidth / 2 + sideW / 2
  const vestry = CHAPEL_DOORS.vestry
  const vestryZ = vestry.point[2] - cz
  const westA = vestryZ - vestry.width / 2 + chz
  const westB = chz - (vestryZ + vestry.width / 2)
  out.push(
    box(cx - sideX, cz - chz, sideW / 2, ct / 2),
    box(cx + sideX, cz - chz, sideW / 2, ct / 2),
    box(cx, cz + chz, chx, ct / 2),
    box(cx - chx, cz + westA / 2 - chz, ct / 2, westA / 2),
    box(cx - chx, cz + chz - westB / 2, ct / 2, westB / 2),
    box(cx + chx, cz, ct / 2, chz),
  )

  for (const c of CORRIDORS) {
    if (c.open) continue
    const mid = c.entranceZ + (c.dir * c.length) / 2
    for (const side of [-1, 1]) {
      out.push(box(c.centerX + side * (c.width / 2 + c.wallThickness / 2), mid, c.wallThickness / 2, c.length / 2))
    }
  }
  return out
}

/** Axis-aligned box around a (possibly turned) cuboid collider, as the zombies' wall probe sees it. */
function turnedBox(c: { position: readonly number[]; rotationY: number; half: readonly number[] }): Box {
  const cos = Math.abs(Math.cos(c.rotationY))
  const sin = Math.abs(Math.sin(c.rotationY))
  return box(c.position[0], c.position[2], c.half[0] * cos + c.half[2] * sin, c.half[0] * sin + c.half[2] * cos)
}

/** The graveyard scene's boxes (perimeter fences, oaks, logs, headstones, crypts) seen from above, as the zombies' wall probe sees them. */
export function graveyardBoxes(): Box[] {
  return GRAVEYARD_COLLIDERS.map((b) => turnedBox({ position: b.center, rotationY: b.rotY, half: b.half }))
}

/** Tombstones, lamp posts and the graveyard scene's boxes: obstacles a zombie must steer around. */
export function propBoxes(): Box[] {
  const out: Box[] = []
  for (const t of TOMBSTONES)
    out.push(turnedBox(headstoneCollider(t.model, headstoneScale(t.height), t.position, t.rotationY)))
  for (const l of LAMP_POSTS) {
    const r = lampCollider(l.position).radius
    out.push(box(l.position[0], l.position[2], r, r))
  }
  out.push(...graveyardBoxes())
  return out
}
/** Slab test for a segment against one box. */
function hits(b: Box, a: Vec2, d: Vec2, len: number): boolean {
  let t0 = 0
  let t1 = len
  const axes: Array<[number, number, number]> = [
    [a.x - b.cx, d.x, b.hx],
    [a.z - b.cz, d.z, b.hz],
  ]
  for (const [o, dir, h] of axes) {
    if (Math.abs(dir) < 1e-12) {
      if (Math.abs(o) > h) return false
    } else {
      let n = (-h - o) / dir
      let f = (h - o) / dir
      if (n > f) [n, f] = [f, n]
      t0 = Math.max(t0, n)
      t1 = Math.min(t1, f)
      if (t0 > t1) return false
    }
  }
  return true
}

export function makeBlocked(boxes: readonly Box[], endMarginM = 0.5) {
  return (a: Vec2, b: Vec2): boolean => {
    const dx = b.x - a.x
    const dz = b.z - a.z
    const full = Math.hypot(dx, dz)
    const len = full - endMarginM
    if (len <= 0) return false
    const d = { x: dx / full, z: dz / full }
    return boxes.some((bx) => hits(bx, a, d, len))
  }
}

/** Playable limit: nothing walks outside the fence. */
export const GROUNDS_LIMIT = GROUNDS_HALF
