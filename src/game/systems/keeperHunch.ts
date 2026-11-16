// Keeper's hunch (spec 10 task 7.1, Req 24.1-24.2, Property 20). Pure: the clock of day play since
// the last clue, whether the hunch is on, its target and the flame's lean. The state is ticked in
// guidanceTick; the HUD flame (LanternGauge) draws the lean.

import { KEEPER_HUNCH } from '../../data/keeperHunch'
import type { Phase } from '../types'

type Vec3 = readonly [number, number, number]

export interface HunchClock {
  /** Seconds of day play since the last new clue (or since the run began). */
  sinceClueS: number
  /** Clues found so far, all cases; a rise is a discovery. */
  found: number
}

export interface HunchCandidate {
  id: string
  position: Vec3
}

export const freshHunchClock = (found = 0): HunchClock => ({ sinceClueS: 0, found })

/**
 * One step. A new clue (a higher count) restarts the clock; a lower count (a new run, a load)
 * restarts it too. Only day play counts: dusk, night and dawn hold the clock.
 */
export function tickHunchClock(c: HunchClock, dt: number, phase: Phase, found: number): HunchClock {
  const n = Number.isFinite(found) ? found : c.found
  if (n !== c.found) return freshHunchClock(n)
  if (phase !== 'day' || !Number.isFinite(dt) || dt <= 0) return c
  return { sinceClueS: c.sinceClueS + dt, found: n }
}

const dist2 = (a: Vec3, b: Vec3): number => (a[0] - b[0]) ** 2 + (a[2] - b[2]) ** 2

/** The candidate nearest `from` on the ground plane; ties keep the first. */
export function nearestCandidate(cands: readonly HunchCandidate[], from: Vec3): HunchCandidate | null {
  let best: HunchCandidate | null = null
  let bestD = Infinity
  for (const c of cands) {
    const d = dist2(c.position, from)
    if (d < bestD) {
      best = c
      bestD = d
    }
  }
  return best
}

/** Property 20: on exactly when 120 s of day play have passed since the last discovery and a clue is left. */
export function hunchActive(c: HunchClock, phase: Phase, unfound: number): boolean {
  return phase === 'day' && c.sinceClueS >= KEEPER_HUNCH.afterS && unfound > 0
}

/** The clue the flame leans toward, or null while the hunch is off. */
export function hunchTarget(
  c: HunchClock,
  phase: Phase,
  cands: readonly HunchCandidate[],
  from: Vec3,
): HunchCandidate | null {
  return hunchActive(c, phase, cands.length) ? nearestCandidate(cands, from) : null
}

/**
 * Lean from -1 (full left) to 1 (full right) for a player at `from` facing `yaw` (0 looks -Z, the
 * game's convention). Ahead it follows the bearing's sideways part; behind it leans fully toward
 * the nearer way round; on top of the clue it stands straight.
 */
export function flameLean(from: Vec3, yaw: number, target: Vec3): number {
  const dx = target[0] - from[0]
  const dz = target[2] - from[2]
  const d = Math.hypot(dx, dz)
  if (!Number.isFinite(d) || !Number.isFinite(yaw) || d < KEEPER_HUNCH.arriveM) return 0
  const fx = -Math.sin(yaw)
  const fz = -Math.cos(yaw)
  const side = (dx * -fz + dz * fx) / d
  const ahead = (dx * fx + dz * fz) / d
  if (ahead >= 0) return Math.max(-1, Math.min(1, side))
  return side < 0 ? -1 : 1
}

/**
 * Skew of the flame in degrees: the lean, plus a slow sway only when head bob is on and motion is
 * not reduced (Req 24.2). A shape change only: brightness is never touched.
 */
export function flameSkewDeg(lean: number, timeS: number, headBob: boolean, reducedMotion: boolean): number {
  const base = lean * KEEPER_HUNCH.maxLeanDeg
  if (lean === 0 || !headBob || reducedMotion) return base
  return base + Math.sin(2 * Math.PI * KEEPER_HUNCH.swayHz * timeS) * KEEPER_HUNCH.swayDeg * Math.abs(lean)
}

/** Eases the drawn lean toward the target lean; reduced motion sets it at once (no animation). */
export function easeLean(current: number, target: number, dt: number, reducedMotion: boolean): number {
  if (reducedMotion || !Number.isFinite(current)) return target
  const k = Math.min(1, Math.max(0, dt) / KEEPER_HUNCH.easeS)
  return current + (target - current) * k
}
