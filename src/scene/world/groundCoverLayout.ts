// Where the grass grows: a jittered grid of clumps over the walled ground, kept off the paths,
// the hut and chapel floors and every graveyard collider (stones, crypts, walls). Pure data, so
// the layout is the same on every load and can be tested.
import { CHAPEL, CHAPEL_CENTER, HUT } from '../../data/cemeteryLayout'
import { GRAVEYARD_COLLIDERS, type GraveyardBox } from '../../data/graveyardColliders'
import { WAYPOINT_EDGES, WAYPOINT_NODES } from '../../data/waypoints'

/** Half the side of the square the grass covers (the flat, walled ground). */
export const COVER_HALF_M = 43
/** Side of one tile; each tile is its own draw, so tiles behind the camera are culled. */
export const COVER_TILE_M = 11
/** Clear ground either side of a path's centre line. */
export const PATH_CLEAR_M = 1.25

export interface Clump {
  x: number
  z: number
  /** Turn about Y, radians. */
  rot: number
  /** Height scale. */
  scale: number
  /** 0 to 1: green-grey to straw. */
  tone: number
}

function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const NODE = new Map(WAYPOINT_NODES.map((n) => [n.id, n] as const))
const SEGMENTS = WAYPOINT_EDGES.flatMap(([a, b]) => {
  const p = NODE.get(a)
  const q = NODE.get(b)
  return p && q ? [[p.x, p.z, q.x, q.z] as const] : []
})

/** Distance from a point to the nearest path centre line. */
export function pathDistance(x: number, z: number): number {
  let best = Infinity
  for (const [ax, az, bx, bz] of SEGMENTS) {
    const dx = bx - ax
    const dz = bz - az
    const len2 = dx * dx + dz * dz
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2))
    best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)))
  }
  return best
}

function insideBox(b: GraveyardBox, x: number, z: number, pad: number): boolean {
  const dx = x - b.center[0]
  const dz = z - b.center[2]
  const c = Math.cos(b.rotY)
  const s = Math.sin(b.rotY)
  // Into the box's own axes (three.js Y rotation).
  const lx = dx * c - dz * s
  const lz = dx * s + dz * c
  return Math.abs(lx) < b.half[0] + pad && Math.abs(lz) < b.half[2] + pad
}

/** Low boxes only: tall walls and crypts block, and so do stones; a kerb's grass still grows round it. */
const BLOCKERS = GRAVEYARD_COLLIDERS.filter((b) => b.center[1] + b.half[1] > 0.12)

/** True where a clump may grow. */
export function grassAllowed(x: number, z: number): boolean {
  if (Math.abs(x) > COVER_HALF_M || Math.abs(z) > COVER_HALF_M) return false
  if (Math.abs(x) < HUT.halfX + 0.5 && Math.abs(z) < HUT.halfZ + 0.6) return false
  if (Math.abs(x - CHAPEL_CENTER[0]) < CHAPEL.halfX + 1.2 && Math.abs(z - CHAPEL_CENTER[2]) < CHAPEL.halfZ + 1.2) return false
  if (pathDistance(x, z) < PATH_CLEAR_M) return false
  for (const b of BLOCKERS) if (insideBox(b, x, z, 0.08)) return false
  return true
}

/**
 * The clumps, grouped by tile. `perSquareMetre` is the density before the clear areas are cut out.
 * Thinner near paths (trodden) and in patches, so the cover is not an even carpet.
 */
export function clumpTiles(perSquareMetre: number, seed = 1891): Clump[][] {
  const r = rng(seed)
  const step = 1 / Math.sqrt(perSquareMetre)
  const tiles = new Map<string, Clump[]>()
  for (let x = -COVER_HALF_M; x < COVER_HALF_M; x += step) {
    for (let z = -COVER_HALF_M; z < COVER_HALF_M; z += step) {
      const px = x + (r() - 0.5) * step * 1.6
      const pz = z + (r() - 0.5) * step * 1.6
      const keep = r()
      const tone = r()
      const rot = r() * Math.PI * 2
      const size = r()
      if (!grassAllowed(px, pz)) continue
      // Trodden near the paths, and bare patches here and there.
      const trodden = Math.max(0, 1 - (pathDistance(px, pz) - PATH_CLEAR_M) / 1.5)
      const patch = 0.5 + 0.5 * Math.sin(px * 0.31 + Math.sin(pz * 0.23) * 2.1) * Math.cos(pz * 0.27 - px * 0.11)
      if (keep < trodden * 0.7 || keep > 0.35 + 0.65 * patch) continue
      const key = `${Math.floor((px + COVER_HALF_M) / COVER_TILE_M)},${Math.floor((pz + COVER_HALF_M) / COVER_TILE_M)}`
      const list = tiles.get(key) ?? []
      list.push({ x: px, z: pz, rot, scale: 0.55 + size * 0.75 * (1 - trodden * 0.5), tone })
      tiles.set(key, list)
    }
  }
  return [...tiles.values()]
}
