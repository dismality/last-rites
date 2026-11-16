// Layout checks for the case props (spec 10 task 3.5, Req 13.1): each bell post stands beside its
// own stone and clear of every gameplay anchor and waypoint leg, so it never blocks a path.
import { describe, expect, it } from 'vitest'
import { CASE_1_BELLS, CASE_1_REWARD, CASE_1_STONES } from './cases'
import { GROUNDS_HALF } from './cemeteryLayout'
import { GRAVEYARD_COLLIDERS } from './graveyardColliders'
import { TOMBSTONES, CLUE_SPOTS } from './tombstones'
import { WAYPOINT_EDGES, WAYPOINT_NODES } from './waypoints'
import { FIXED_SPAWNS, SPAWN_POINTS } from './zones'

/** A post is a 0.1 m pole; keep a body's width of free ground around it. */
const POST_CLEAR_M = 0.6
/** Interactable anchors (pickups, clue spots) must be at least this far from a post. */
const ANCHOR_CLEAR_M = 1.5
/** Zombies walk the waypoint legs; a post must leave the leg itself free. */
const LEG_CLEAR_M = 1.5

const xz = (p: readonly number[]): [number, number] => [p[0], p[2]]

function distToSegment(p: [number, number], a: [number, number], b: [number, number]): number {
  const [dx, dz] = [b[0] - a[0], b[1] - a[1]]
  const len2 = dx * dx + dz * dz
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / len2))
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dz))
}

/** Distance from a point to a box turned about Y (0 inside it). */
function distToBox(p: [number, number], box: (typeof GRAVEYARD_COLLIDERS)[number]): number {
  const [dx, dz] = [p[0] - box.center[0], p[1] - box.center[2]]
  const c = Math.cos(-box.rotY)
  const s = Math.sin(-box.rotY)
  const lx = Math.abs(dx * c - dz * s) - box.half[0]
  const lz = Math.abs(dx * s + dz * c) - box.half[2]
  return Math.hypot(Math.max(lx, 0), Math.max(lz, 0))
}

describe('bell post placement (1b)', () => {
  const stone = (id: string) => CASE_1_STONES.find((s) => s.id === id)!

  it('each post stands 0.8 to 1.6 m from its own stone, inside the grounds', () => {
    for (const post of CASE_1_BELLS) {
      const d = Math.hypot(post.position[0] - stone(post.stone).position[0], post.position[2] - stone(post.stone).position[2])
      expect(d, post.id).toBeGreaterThanOrEqual(0.8)
      expect(d, post.id).toBeLessThanOrEqual(1.6)
      expect(Math.abs(post.position[0])).toBeLessThan(GROUNDS_HALF)
      expect(Math.abs(post.position[2])).toBeLessThan(GROUNDS_HALF)
    }
  })

  it('posts clear every collision box of the graveyard', () => {
    for (const post of CASE_1_BELLS) {
      for (const box of GRAVEYARD_COLLIDERS) {
        expect(distToBox(xz(post.position), box), `${post.id} vs box at ${box.center}`).toBeGreaterThanOrEqual(POST_CLEAR_M)
      }
    }
  })

  it('posts clear tombstones, spawn points, fixed spawns, clue spots, the key mound and each other', () => {
    const anchors: { name: string; at: [number, number] }[] = [
      ...TOMBSTONES.map((t) => ({ name: `tombstone ${t.id}`, at: xz(t.position) })),
      ...SPAWN_POINTS.map((s) => ({ name: `spawn ${s.id}`, at: xz(s.position) })),
      ...FIXED_SPAWNS.map((s) => ({ name: `fixed ${s.id}`, at: xz(s.position) })),
      ...CLUE_SPOTS.map((c) => ({ name: `clue ${c.clueId}`, at: xz(c.position) })),
      { name: 'key mound', at: xz(CASE_1_REWARD.position) },
    ]
    for (const post of CASE_1_BELLS) {
      for (const a of anchors) {
        // A post's own stone is meant to be near; the other anchors must keep clear.
        const limit = a.name === `tombstone ${post.stone}` || a.name === 'key mound' || a.name === 'fixed fx-crypt-key' ? 0.6 : ANCHOR_CLEAR_M
        expect(Math.hypot(post.position[0] - a.at[0], post.position[2] - a.at[1]), `${post.id} vs ${a.name}`).toBeGreaterThanOrEqual(limit)
      }
      for (const other of CASE_1_BELLS.filter((o) => o.id !== post.id)) {
        expect(Math.hypot(post.position[0] - other.position[0], post.position[2] - other.position[2])).toBeGreaterThan(2)
      }
    }
  })

  it('posts keep clear of every waypoint leg', () => {
    const node = (id: string) => WAYPOINT_NODES.find((n) => n.id === id)!
    for (const post of CASE_1_BELLS) {
      for (const [a, b] of WAYPOINT_EDGES) {
        const d = distToSegment(xz(post.position), [node(a).x, node(a).z], [node(b).x, node(b).z])
        expect(d, `${post.id} vs ${a}-${b}`).toBeGreaterThanOrEqual(LEG_CLEAR_M)
      }
    }
  })
})
