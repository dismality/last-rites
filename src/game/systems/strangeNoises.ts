// When the strange distant noises sound and which one (src/data/strangeNoises.ts). Pure: no audio,
// React or three.js. Atmosphere only: nothing here touches the game state.

import { STRANGE_NOISES, STRANGE_TIMING, type StrangeNoiseDef } from '../../data/strangeNoises'
import type { Phase } from '../types'

export interface StrangeClock {
  /** Seconds until the next noise. */
  nextIn: number
  /** The last noise played, so the same one never plays twice running. */
  last: StrangeNoiseDef['id'] | null
}

export interface StrangeCue {
  noise: StrangeNoiseDef
  /** Direction around the listener (radians). */
  angle: number
  distanceM: number
}

const TAU = Math.PI * 2
const between = (rand: () => number, min: number, max: number): number => min + rand() * (max - min)

export function createStrangeClock(): StrangeClock {
  return { nextIn: STRANGE_TIMING.firstAfterS, last: null }
}

/** The gap before the next noise: longer by day. */
export function strangeGap(phase: Phase, rand: () => number): number {
  const g = between(rand, STRANGE_TIMING.gapS.min, STRANGE_TIMING.gapS.max)
  return phase === 'day' ? g * STRANGE_TIMING.dayGapMult : g
}

/** A weighted pick that never repeats `last` (when there is anything else to pick). */
export function pickStrangeNoise(last: StrangeNoiseDef['id'] | null, rand: () => number): StrangeNoiseDef {
  const pool = STRANGE_NOISES.filter((n) => n.id !== last)
  const list = pool.length > 0 ? pool : STRANGE_NOISES
  const total = list.reduce((s, n) => s + n.weight, 0)
  let r = rand() * total
  for (const n of list) {
    r -= n.weight
    if (r < 0) return n
  }
  return list[list.length - 1]
}

/**
 * Advance the clock by `dt`; returns the noise to play this frame, if any. `enabled` false (the
 * setting at 0) keeps the clock running but plays nothing.
 */
export function stepStrangeNoises(
  clock: StrangeClock,
  dt: number,
  phase: Phase,
  enabled: boolean,
  rand: () => number,
): { clock: StrangeClock; cue: StrangeCue | null } {
  if (!(dt > 0) || !Number.isFinite(dt)) return { clock, cue: null }
  const left = clock.nextIn - dt
  if (left > 0) return { clock: { ...clock, nextIn: left }, cue: null }
  const next = strangeGap(phase, rand)
  if (!enabled) return { clock: { ...clock, nextIn: next }, cue: null }
  const noise = pickStrangeNoise(clock.last, rand)
  const distanceM = noise.near
    ? STRANGE_TIMING.nearDistanceM
    : between(rand, STRANGE_TIMING.distanceM.min, STRANGE_TIMING.distanceM.max)
  return { clock: { nextIn: next, last: noise.id }, cue: { noise, angle: rand() * TAU, distanceM } }
}
