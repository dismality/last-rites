// Corpse Hound pack rules (spec 11 H2). Pure TypeScript: no React, three.js or Howler imports.
// A pack of 2 to 3 circles the player at 4 to 6 m. One hound at a time warns (a growl, 0.5 to
// 1.5 s) and darts in for 10; darts start at least 2 s apart. A gunshot or lantern flare within
// 15 m scatters the pack for 4 s, and nothing bites while it is scattered.

import { ENEMY_MAP } from '../../data/enemies'
import { HOUND } from '../../data/creatures'
import type { Rng } from '../rng'
import type { Vec2 } from './combat'
import { tellLead } from './creatureTells'

export type HoundMode = 'circle' | 'tell' | 'dart' | 'away' | 'return'

export interface Hound {
  id: string
  x: number
  z: number
  mode: HoundMode
  /** Polar position around the player while circling (rad), the ring radius (m) and the lap direction. */
  angle: number
  ring: number
  dir: 1 | -1
  /** Seconds left of the growl before the dart; null outside the tell. */
  tellLeft: number | null
  /** Seconds this dart has run. */
  dartT: number
}

export interface PackState {
  hounds: Hound[]
  /** Sim seconds since the pack formed. */
  t: number
  /** When the latest dart began (its growl), or the pack's start so the first dart waits 2 s. */
  lastDartStart: number
  /** Nothing bites before this time. */
  scatterUntil: number
}

export interface PackEvent {
  kind: 'gunshot' | 'flare'
  /** Distance from the event to the pack (m). */
  distM: number
}

export type PackOutEvent =
  | { type: 'tell'; houndId: string; lead: number }
  | { type: 'bite'; houndId: string; damage: number }
  | { type: 'scatter' }

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))
const speed = ENEMY_MAP.hound.speed

/** A pack of `size` (clamped to 2..3) hounds spread evenly around the player. */
export function createPack(player: Vec2, size: number, rng: Rng): PackState {
  const n = clamp(Math.floor(Number.isFinite(size) ? size : HOUND.packMin), HOUND.packMin, HOUND.packMax)
  const start = rng() * Math.PI * 2
  const hounds: Hound[] = Array.from({ length: n }, (_, i) => {
    const angle = start + (i * Math.PI * 2) / n
    const ring = HOUND.circleMinM + rng() * (HOUND.circleMaxM - HOUND.circleMinM)
    return {
      id: `hound-${i}`,
      x: player.x + Math.cos(angle) * ring,
      z: player.z + Math.sin(angle) * ring,
      mode: 'circle',
      angle,
      ring,
      dir: i % 2 === 0 ? 1 : -1,
      tellLeft: null,
      dartT: 0,
    }
  })
  return { hounds, t: 0, lastDartStart: 0, scatterUntil: -Infinity }
}

/** True for a hound that is warning or darting. */
export const isDarting = (h: Hound): boolean => h.mode === 'tell' || h.mode === 'dart'

/** True while the pack is scattered and harmless. */
export const isScattered = (p: PackState): boolean => p.t < p.scatterUntil

/** Moves `h` by at most `step` metres to the point at distance `target` from the player on its own bearing. */
function moveRadially(h: Hound, player: Vec2, target: number, step: number): Hound {
  const dx = h.x - player.x
  const dz = h.z - player.z
  const d = Math.hypot(dx, dz)
  if (d < 1e-6) return { ...h, x: player.x + target, z: player.z }
  const nd = d + clamp(target - d, -step, step)
  return { ...h, x: player.x + (dx / d) * nd, z: player.z + (dz / d) * nd }
}

function stepHound(
  h: Hound,
  player: Vec2,
  dt: number,
  scattered: boolean,
  out: PackOutEvent[],
): { hound: Hound; damage: number } {
  const step = speed * dt
  const dx = h.x - player.x
  const dz = h.z - player.z
  const d = Math.hypot(dx, dz)
  switch (h.mode) {
    case 'circle': {
      const angle = h.angle + (h.dir * HOUND.circleSpeedMps * dt) / h.ring
      // Polar, so the pack follows the player and holds the ring at every step.
      return {
        hound: { ...h, angle, x: player.x + Math.cos(angle) * h.ring, z: player.z + Math.sin(angle) * h.ring },
        damage: 0,
      }
    }
    case 'tell': {
      const left = (h.tellLeft ?? 0) - dt
      return { hound: left > 0 ? { ...h, tellLeft: left } : { ...h, mode: 'dart', tellLeft: null, dartT: 0 }, damage: 0 }
    }
    case 'dart': {
      if (!scattered && d <= HOUND.dartReachM) {
        out.push({ type: 'bite', houndId: h.id, damage: HOUND.dartDamage })
        return { hound: { ...h, mode: 'return', dartT: 0 }, damage: HOUND.dartDamage }
      }
      const dartT = h.dartT + dt
      if (dartT > HOUND.dartMaxS) return { hound: { ...h, mode: 'return', dartT: 0 }, damage: 0 }
      return { hound: { ...moveRadially(h, player, 0, step), dartT }, damage: 0 }
    }
    case 'away': {
      // Run from the player until the scatter is over, then come back to the ring.
      if (!scattered) return { hound: { ...h, mode: 'return' }, damage: 0 }
      return { hound: moveRadially(h, player, HOUND.circleMaxM + HOUND.scatterRadiusM, step), damage: 0 }
    }
    case 'return': {
      if (d >= HOUND.circleMinM && d <= HOUND.circleMaxM) {
        return { hound: { ...h, mode: 'circle', angle: Math.atan2(dz, dx), ring: d }, damage: 0 }
      }
      return { hound: moveRadially(h, player, clamp(d, HOUND.circleMinM, HOUND.circleMaxM), step), damage: 0 }
    }
  }
}

/** Advances the pack by `dt` seconds. At most one hound warns or darts at a time. */
export function stepPack(
  pack: PackState,
  player: Vec2,
  event: PackEvent | null,
  dt: number,
  rng: Rng,
): { pack: PackState; damage: number; events: PackOutEvent[] } {
  const step = Math.max(0, Number.isFinite(dt) ? dt : 0)
  const events: PackOutEvent[] = []
  const t = pack.t + step
  let scatterUntil = pack.scatterUntil
  let hounds = pack.hounds
  let lastDartStart = pack.lastDartStart

  if (event && Number.isFinite(event.distM) && event.distM <= HOUND.scatterRadiusM) {
    scatterUntil = t + HOUND.scatterS
    hounds = hounds.map((h) => ({ ...h, mode: 'away', tellLeft: null, dartT: 0 }))
    events.push({ type: 'scatter' })
  }
  const scattered = t < scatterUntil

  let damage = 0
  hounds = hounds.map((h) => {
    const r = stepHound(h, player, step, scattered, events)
    damage += r.damage
    return r.hound
  })

  if (!scattered && !hounds.some(isDarting) && t - lastDartStart >= HOUND.dartGapS) {
    const ready = hounds.filter((h) => h.mode === 'circle')
    if (ready.length > 0) {
      const pick = ready[Math.min(ready.length - 1, Math.floor(rng() * ready.length))]
      const lead = tellLead(rng)
      hounds = hounds.map((h) => (h.id === pick.id ? { ...h, mode: 'tell', tellLeft: lead } : h))
      lastDartStart = t
      events.push({ type: 'tell', houndId: pick.id, lead })
    }
  }

  return { pack: { hounds, t, lastDartStart, scatterUntil }, damage, events }
}
