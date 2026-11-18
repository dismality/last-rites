// Belfry flock rules (spec 11 task 4.4, Req 4.12 to 4.14, 8.6, 8.7). Pure: the scene draws the flock
// and feeds this the frame times, the phase and the settings. No React, three.js or Howler.

import { BAT } from '../../data/bats'

const F = BAT.belfryFlock

export interface FlockSeed {
  /** Heading away from the belfry, radians. */
  angle: number
  speed: number
  /** Wing-beat phase, radians. */
  phase: number
  /** Body scale around 1. */
  size: number
}

/** Adds one frame time (ms) to a rolling window of at most `frameWindow` frames. */
export function pushFrame(window: readonly number[], ms: number): number[] {
  const next =
    window.length >= F.frameWindow
      ? window.slice(window.length - F.frameWindow + 1)
      : window.slice()
  next.push(ms)
  return next
}

/** Mean of the window; 0 for an empty one. */
export function frameAverageMs(window: readonly number[]): number {
  if (window.length === 0) return 0
  let sum = 0
  for (const v of window) sum += v
  return sum / window.length
}

export interface FlockStartFacts {
  phase: 'day' | 'dusk' | 'night' | 'dawn'
  frames: readonly number[]
  /** A flock is already flying. */
  active: boolean
}

/** The flock starts only at dusk, once at a time, and is skipped when frames average over the budget. */
export function shouldStartFlock(f: FlockStartFacts): boolean {
  if (f.phase !== 'dusk' || f.active) return false
  return frameAverageMs(f.frames) <= F.frameBudgetMs
}

/** Bat count in [min, max] from a 0..1 roll. */
export function flockCount(roll: number): number {
  const r = Math.min(Math.max(roll, 0), 0.999999)
  return F.min + Math.floor(r * (F.max - F.min + 1))
}

/** One seed per bat from a roll source, so the layout is testable with a fixed generator. */
export function flockSeeds(count: number, rand: () => number): FlockSeed[] {
  const out: FlockSeed[] = []
  for (let i = 0; i < count; i++) {
    out.push({
      angle: rand() * Math.PI * 2,
      speed: F.speedMps + (rand() * 2 - 1) * F.speedSpreadMps,
      phase: rand() * Math.PI * 2,
      size: F.sizeMin + rand() * F.sizeSpread,
    })
  }
  return out
}

/** The flock flies while its age is under maxS (the fade ends exactly at maxS). */
export const flockActive = (ageS: number): boolean => ageS >= 0 && ageS < F.maxS

export interface FlockEffects {
  /** The flock never shakes the camera, so Camera shake off trivially holds (Req 8.7). */
  cameraShake: false
  /** Glow pulses only with Flashing lights on; otherwise it is steady (Req 8.6). */
  pulsingGlow: boolean
}

export function flockEffects(settings: {
  cameraShake: boolean
  flashingLights: boolean
}): FlockEffects {
  return { cameraShake: false, pulsingGlow: settings.flashingLights }
}

/** Emissive strength for the shader at an age: steady when Flashing lights is off. */
export function flockGlow(ageS: number, flashingLights: boolean): number {
  if (!flashingLights) return F.glowSteady
  const wave = 0.5 + 0.5 * Math.sin(2 * Math.PI * F.glowPulseHz * ageS)
  return F.glowPulseMin + (F.glowPulseMax - F.glowPulseMin) * wave
}
