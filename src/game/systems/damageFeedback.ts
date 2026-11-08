// Pure maths for damage feedback (combat-waves Req 6.1, 6.2).
// Rendering and audio read these values; no rules live in the components.

import { LOW_HEALTH_THRESHOLD } from '../../data/balance'

/** How long the red vignette and flame dip last after a hit. */
export const HIT_FEEDBACK_MS = 600
/** Peak vignette opacity right after a hit. */
export const VIGNETTE_PEAK = 0.55
/** Fraction of flame height lost at the instant of a hit. */
export const FLAME_DIP_PEAK = 0.35
/** Saturation change (postprocessing HueSaturation scale, -1..1) at 0 HP. */
export const MAX_DESATURATION = 0.35
/** Heartbeat interval at the threshold and at 0 HP, in seconds. */
export const HEARTBEAT_SLOW_S = 1.2
export const HEARTBEAT_FAST_S = 0.6

/** 1 right after a hit, fading linearly to 0 over HIT_FEEDBACK_MS. */
export function hitDecay(msSinceHit: number): number {
  if (!Number.isFinite(msSinceHit) || msSinceHit < 0 || msSinceHit >= HIT_FEEDBACK_MS) return 0
  return 1 - msSinceHit / HIT_FEEDBACK_MS
}

/**
 * Red vignette opacity. Zero when flashing lights are off so the effect
 * never flashes for players who disabled it (Req 6.1).
 */
export function vignetteOpacity(msSinceHit: number, flashingLights: boolean): number {
  if (!flashingLights) return 0
  return hitDecay(msSinceHit) * VIGNETTE_PEAK
}

/** Multiplier (0..1) applied to flame height; the dip is kept even with flashing off. */
export function flameDipFactor(msSinceHit: number): number {
  return 1 - hitDecay(msSinceHit) * FLAME_DIP_PEAK
}

/** Negative saturation offset, 0 at or above the threshold, growing as health falls. */
export function desaturation(health: number): number {
  if (!(health < LOW_HEALTH_THRESHOLD)) return 0
  const h = Math.max(0, health)
  return -MAX_DESATURATION * (1 - h / LOW_HEALTH_THRESHOLD)
}

/** Seconds between heartbeats, or null when health is not low (or dead). */
export function heartbeatInterval(health: number): number | null {
  if (!(health < LOW_HEALTH_THRESHOLD) || health <= 0) return null
  const t = 1 - Math.max(0, health) / LOW_HEALTH_THRESHOLD
  return HEARTBEAT_SLOW_S + (HEARTBEAT_FAST_S - HEARTBEAT_SLOW_S) * t
}
