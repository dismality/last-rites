// Dev-only: names the object that owns a Rapier collider, so a block can be attributed.
// Colliders carry no names, so each one is matched by position against the same layout data the
// scene builds them from. Anything that matches nothing is reported as 'unknown' (a stray collider).
import { HUT, CHAPEL_CENTER, LAMP_POSTS } from '../data/cemeteryLayout'
import { GRAVEYARD_COLLIDERS } from '../data/graveyardColliders'
import { TOMBSTONES } from '../data/tombstones'

interface Anchor {
  name: string
  x: number
  z: number
}

const MATCH_M = 0.02

let anchors: Anchor[] | null = null

function build(): Anchor[] {
  const out: Anchor[] = []
  GRAVEYARD_COLLIDERS.forEach((b, i) => out.push({ name: `graveyard#${i}`, x: b.center[0], z: b.center[2] }))
  LAMP_POSTS.forEach((l, i) => out.push({ name: `lamp#${i}`, x: l.position[0], z: l.position[2] }))
  for (const t of TOMBSTONES) out.push({ name: `tombstone:${t.id}`, x: t.position[0], z: t.position[2] })
  out.push({ name: 'hut', x: 0, z: 0 })
  out.push({ name: 'chapel', x: CHAPEL_CENTER[0], z: CHAPEL_CENTER[2] })
  return out
}

/** Owner of a collider centred at (x, z), by exact position match against the layout data. */
export function colliderOwner(x: number, z: number): string {
  anchors ??= build()
  const hit = anchors.find((a) => Math.hypot(a.x - x, a.z - z) < MATCH_M)
  if (hit) return hit.name
  // Boxes in the hut and chapel are centred off their anchor; name them by region.
  if (Math.abs(x) < HUT.halfX + 1 && Math.abs(z) < HUT.halfZ + 1) return 'hut-part'
  if (Math.abs(x - CHAPEL_CENTER[0]) < 4 && Math.abs(z - CHAPEL_CENTER[2]) < 7) return 'chapel-part'
  return 'unknown'
}
