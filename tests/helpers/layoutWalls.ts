// The real cemetery's walls as axis-aligned boxes, built only from src/data, plus a segment probe
// that mirrors scene/enemies/wallProbe.ts (knee-high ray, stops 0.5 m short of its end).
// Mirrors the colliders in Hut.tsx, ChapelBuilding.tsx and Cemetery.tsx; keep them in step.
import {
  CHAPEL,
  CHAPEL_CENTER,
  CHAPEL_DOORS,
  CORRIDORS,
  CRANE_CRYPT,
  GROUNDS_HALF,
  HEADSTONE,
  HUT,
  FENCE,
  LAMP_COLLIDER,
  LAMP_POSTS,
  TREE,
  buildFenceSegments,
  craneCryptPosition,
  generateHeadstones,
  generateTrees,
} from '../../src/data/cemeteryLayout'
import { FIXED_SPAWNS, SPAWN_POINTS } from '../../src/data/zones'
import type { Vec2 } from '../../src/game/systems/combat'

export interface Box {
  cx: number
  cz: number
  hx: number
  hz: number
}

const box = (cx: number, cz: number, hx: number, hz: number): Box => ({ cx, cz, hx, hz })

/** Hut, chapel, fences, corridor walls and the crypt: the big structures. */
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

  for (const s of buildFenceSegments()) {
    const mid = (s.from + s.to) / 2
    const half = (s.to - s.from) / 2
    const t = FENCE.colliderHalfThickness
    out.push(s.axis === 'x' ? box(mid, s.fixed, half, t) : box(s.fixed, mid, t, half))
  }
  for (const c of CORRIDORS) {
    if (c.open) continue
    const mid = c.entranceZ + (c.dir * c.length) / 2
    for (const side of [-1, 1]) {
      out.push(box(c.centerX + side * (c.width / 2 + c.wallThickness / 2), mid, c.wallThickness / 2, c.length / 2))
    }
  }
  const [kx, , kz] = craneCryptPosition()
  out.push(box(kx, kz, CRANE_CRYPT.halfX, CRANE_CRYPT.halfZ))
  return out
}

/** Headstones, trees and lamp posts: small obstacles a zombie must steer around. */
export function propBoxes(): Box[] {
  const out: Box[] = []
  for (const h of generateHeadstones()) out.push(box(h.position[0], h.position[2], HEADSTONE.width / 2, HEADSTONE.depth / 2))
  const avoid = [...SPAWN_POINTS.map((p) => p.position), ...FIXED_SPAWNS.map((p) => p.position)]
  for (const t of generateTrees(avoid)) {
    const half = t.kind.startsWith('pine') ? TREE.pineColliderHalf : TREE.trunkColliderHalf
    out.push(box(t.position[0], t.position[2], half, half))
  }
  for (const l of LAMP_POSTS) out.push(box(l.position[0], l.position[2], LAMP_COLLIDER.half, LAMP_COLLIDER.half))
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
