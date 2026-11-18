// Hollow Bride rules (spec 11 H2). Pure TypeScript: no React, three.js or Howler imports.
// A haunting from stage 2, at most one alive, never in a wave or elite roll. She is seen only in
// the lantern cone or within 3 m. She cannot hurt: her touch drinks 20 points of oil.

import { BRIDE } from '../../data/creatures'
import { WEAPON_MAP } from '../../data/weapons'
import type { Rng } from '../rng'
import type { Vec2 } from './combat'
import { tellLead } from './creatureTells'
import { brideDimFor, stepBrideDim } from './lanternFlicker'
import type { SaltCircle } from './projectiles'

export interface BrideState {
  alive: boolean
  x: number
  z: number
  /** Seconds before she may return after a touch; 0 means she may appear. */
  returnIn: number
  /** Seconds left of her warning before the touch lands; null while none runs. */
  tellLeft: number | null
}

export type BrideEvent = { type: 'tell'; lead: number } | { type: 'touch' }

export function createBride(): BrideState {
  return { alive: false, x: 0, z: 0, returnIn: 0, tellLeft: null }
}

/** She may appear only from stage 2 on, and only when none is alive and her return delay is over. */
export function brideCanSpawn(world: { stage: number; brideAlive: boolean; returnIn?: number }): boolean {
  return world.stage >= BRIDE.fromStage && !world.brideAlive && (world.returnIn ?? 0) <= 0
}

/** Counts the return delay down (it never goes below 0). */
export function tickBrideReturn(b: BrideState, dt: number): BrideState {
  return b.alive || b.returnIn <= 0 ? b : { ...b, returnIn: Math.max(0, b.returnIn - Math.max(0, dt)) }
}

/** Brings her in at `pos`, if the world allows it. */
export function spawnBride(b: BrideState, world: { stage: number }, pos: Vec2): BrideState {
  if (!brideCanSpawn({ stage: world.stage, brideAlive: b.alive, returnIn: b.returnIn })) return b
  return { alive: true, x: pos.x, z: pos.z, returnIn: 0, tellLeft: null }
}

/**
 * Visible iff she is inside the lit lantern cone, or within 3 m of the player. An unseen bride
 * still moves; only her drawing changes.
 */
export function brideVisible(b: Vec2, player: Vec2, lanternOn: boolean, inCone: boolean): boolean {
  if (Math.hypot(b.x - player.x, b.z - player.z) <= BRIDE.revealRadiusM) return true
  return lanternOn && inCone
}

/** Advances her drift and her warning. The touch event fires only after the warning ran its lead. */
export function stepBride(
  b: BrideState,
  player: Vec2,
  dt: number,
  rng: Rng,
): { bride: BrideState; events: BrideEvent[] } {
  if (!b.alive) return { bride: b, events: [] }
  const step = Math.max(0, Number.isFinite(dt) ? dt : 0)
  const events: BrideEvent[] = []
  const d = Math.hypot(player.x - b.x, player.z - b.z)
  let next = b
  const stopAt = BRIDE.touchRangeM * 0.5
  if (d > stopAt) {
    const k = Math.min(BRIDE.driftSpeedMps * step, d - stopAt) / d
    next = { ...b, x: b.x + (player.x - b.x) * k, z: b.z + (player.z - b.z) * k }
  }
  const near = Math.hypot(player.x - next.x, player.z - next.z) <= BRIDE.touchRangeM
  if (next.tellLeft === null) {
    if (!near) return { bride: next, events }
    const lead = tellLead(rng)
    events.push({ type: 'tell', lead })
    return { bride: { ...next, tellLeft: lead }, events }
  }
  const left = next.tellLeft - step
  if (left > 0) return { bride: { ...next, tellLeft: left }, events }
  if (near) events.push({ type: 'touch' })
  // Out of reach after the warning: she lets the warning lapse and starts again when close.
  return { bride: { ...next, tellLeft: null }, events }
}

/**
 * Her touch: the fuel falls by 20 points (never below 0), she vanishes, and she returns after
 * 30 to 60 s. The caller applies the returned fuel.
 */
export function brideTouch(b: BrideState, fuel: number, rng: Rng): { bride: BrideState; fuel: number } {
  const f = Number.isFinite(fuel) ? fuel : 0
  const delay = BRIDE.respawnMinS + Math.min(1, Math.max(0, rng())) * (BRIDE.respawnMaxS - BRIDE.respawnMinS)
  return {
    bride: { ...b, alive: false, tellLeft: null, returnIn: delay },
    fuel: Math.max(0, f - BRIDE.drainPoints),
  }
}

/** What stops her. Fences and gravestones are `prop` and never stop her; walls do. */
export interface BrideCollider {
  kind: 'wall' | 'prop'
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

/** Segment against an axis-aligned box (slab method); true when they touch. */
function segmentHitsBox(a: Vec2, b: Vec2, box: BrideCollider): boolean {
  let t0 = 0
  let t1 = 1
  const dx = b.x - a.x
  const dz = b.z - a.z
  for (const [p, q, lo, hi] of [
    [a.x, dx, box.minX, box.maxX],
    [a.z, dz, box.minZ, box.maxZ],
  ] as const) {
    if (q === 0) {
      if (p < lo || p > hi) return false
      continue
    }
    const u = (lo - p) / q
    const v = (hi - p) / q
    t0 = Math.max(t0, Math.min(u, v))
    t1 = Math.min(t1, Math.max(u, v))
    if (t0 > t1) return false
  }
  return true
}

/**
 * True when stepping from `from` to `to` is stopped: the step crosses a chapel or hut wall, or
 * ends inside a salt circle it did not already stand in (a bride inside one may step out).
 */
export function brideMoveBlocked(
  from: Vec2,
  to: Vec2,
  colliders: readonly BrideCollider[],
  salts: readonly Pick<SaltCircle, 'pos'>[],
): boolean {
  if (colliders.some((c) => c.kind === 'wall' && segmentHitsBox(from, to, c))) return true
  const r = WEAPON_MAP['salt-circle'].radius ?? 0
  return salts.some((s) => {
    const dTo = Math.hypot(to.x - s.pos.x, to.z - s.pos.z)
    const dFrom = Math.hypot(from.x - s.pos.x, from.z - s.pos.z)
    return dTo <= r && dTo < dFrom
  })
}

export type BrideDamageSource = 'lead' | 'holy-water' | 'silver-sabre' | 'blessed-rounds' | 'other'

/** Lead passes through her (0 damage and a no-effect cue); every other source deals its normal damage. */
export function brideDamage(source: BrideDamageSource, amount: number): { damage: number; noEffectCue: boolean } {
  if (source === 'lead') return { damage: 0, noEffectCue: true }
  return { damage: Number.isFinite(amount) ? Math.max(0, amount) : 0, noEffectCue: false }
}

/**
 * The lantern near her: light multiplied by 0.7 within 8 m, the flame bending more the closer she
 * is. With Flashing lights off the dim changes by at most 0.7 per second and the bend is steady.
 */
export function lanternBend(
  distanceM: number,
  currentDim: number,
  dt: number,
  flashingLights: boolean,
): { dim: number; bend: number; target: number } {
  const target = brideDimFor(distanceM)
  const dim = stepBrideDim(currentDim, distanceM, dt, flashingLights)
  const bend = distanceM <= BRIDE.lanternDimNearM ? 1 - Math.max(0, distanceM) / BRIDE.lanternDimNearM : 0
  return { dim, bend: Math.min(1, Math.max(0, bend)), target }
}
