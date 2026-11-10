// Pure lantern fuel and light-radius logic.

import {
  LANTERN_DRAIN_PERCENT_PER_S_DAY,
  LANTERN_DRAIN_S_PER_PERCENT_NIGHT,
  LANTERN_EMBER_RADIUS_M,
  LANTERN_FLICKER_BELOW,
  LANTERN_GLARE_FULL_M,
  LANTERN_GLARE_MIN_SCALE,
  LANTERN_MAX_FUEL,
  LANTERN_RADIUS_MAX_M,
  LANTERN_RADIUS_MIN_M,
} from '../../data/balance'
import type { LanternState, Phase } from '../types'

/**
 * Percent of fuel burned per second. Dusk counts as night: the light is already failing and the
 * player should be hurrying back. Day and dawn burn nothing.
 */
function drainPercentPerSecond(phase: Phase): number {
  return phase === 'night' || phase === 'dusk'
    ? 1 / LANTERN_DRAIN_S_PER_PERCENT_NIGHT
    : LANTERN_DRAIN_PERCENT_PER_S_DAY
}

/** drainMult comes from lanternDrainMultiplier (mode, Long Wick, storm); 1 keeps the base rate. */
export function tickLantern(
  s: LanternState,
  dt: number,
  phase: Phase,
  drainMult = 1,
): LanternState {
  const drain = s.on
    ? Math.max(0, dt) * Math.max(0, drainMult) * drainPercentPerSecond(phase)
    : 0
  const fuel = Math.min(LANTERN_MAX_FUEL, Math.max(0, s.fuel - drain))
  return { on: s.on, fuel, flicker: fuel < LANTERN_FLICKER_BELOW }
}

/** Light radius normalised to 0..1 of the full-fuel radius, so rendering needs no balance numbers. */
export function lanternIntensity(fuel: number): number {
  return lanternRadius(fuel) / LANTERN_RADIUS_MAX_M
}

/** Linear 2 m..8 m, with a 1.5 m ember at exactly empty so the world is never fully black. */
export function lanternRadius(fuel: number): number {
  const f = Math.min(LANTERN_MAX_FUEL, Math.max(0, fuel))
  if (f === 0) return LANTERN_EMBER_RADIUS_M
  return (
    LANTERN_RADIUS_MIN_M +
    ((LANTERN_RADIUS_MAX_M - LANTERN_RADIUS_MIN_M) * f) / LANTERN_MAX_FUEL
  )
}

/**
 * Brightness share for the beam with the nearest surface ahead `distM` away (spec 09, B8).
 * 1 at LANTERN_GLARE_FULL_M or beyond (or nothing hit), falling with the square of the
 * distance, never below LANTERN_GLARE_MIN_SCALE. NaN counts as nothing hit.
 */
export function wallGlareScale(distM: number): number {
  if (!(distM < LANTERN_GLARE_FULL_M)) return 1
  const r = Math.max(0, distM) / LANTERN_GLARE_FULL_M
  return Math.max(LANTERN_GLARE_MIN_SCALE, r * r)
}
