// All Hallows' Eve dressing rules (design bible §15): candle flicker, blowing leaves, the harvest
// moon's fade and the autumn ambience timing. Pure: no React, three.js or Howler imports.

import {
  AUTUMN_AMBIENCE,
  CANDLE_FLICKER,
  HARVEST_MOON,
  LEAVES,
  MOON_SHOW,
} from '../../data/allHallows'
import type { Phase } from '../types'

const TAU = Math.PI * 2

// --- Candle flicker -------------------------------------------------------------

/**
 * Brightness of a candle flame at time `t` (seconds), around 1. `seed` offsets each lantern so
 * no two pulse together; `calm` (Flashing lights off) shrinks the swing to a slight breath.
 * Always within 1 ± the swing.
 */
export function candleFlicker(t: number, seed: number, calm: boolean): number {
  const amount = calm ? CANDLE_FLICKER.calmAmount : CANDLE_FLICKER.amount
  if (!Number.isFinite(t) || !Number.isFinite(seed)) return 1
  const [ws, wm, wf] = CANDLE_FLICKER.weights
  const [ss, sm, sf] = CANDLE_FLICKER.seedSpread
  const wave =
    ws * Math.sin(TAU * CANDLE_FLICKER.slowHz * t + seed * ss) +
    wm * Math.sin(TAU * CANDLE_FLICKER.midHz * t + seed * sm) +
    wf * Math.sin(TAU * CANDLE_FLICKER.fastHz * t + seed * sf)
  return 1 + amount * wave
}

// --- Leaves ---------------------------------------------------------------------

export interface LeafField {
  readonly count: number
  readonly x: Float32Array
  readonly y: Float32Array
  readonly z: Float32Array
  readonly fall: Float32Array
  readonly flutterHz: Float32Array
  readonly phase: Float32Array
  /** Seconds left lying on the ground; negative while falling. */
  readonly ground: Float32Array
  /** Index into LEAVES.colors. */
  readonly color: Uint8Array
}

const between = (r: () => number, lo: number, hi: number): number => lo + r() * (hi - lo)

function spawnLeaf(f: LeafField, i: number, cx: number, cz: number, rand: () => number, height: number): void {
  const half = LEAVES.boxM / 2
  f.x[i] = cx + between(rand, -half, half)
  f.z[i] = cz + between(rand, -half, half)
  f.y[i] = height
  f.ground[i] = -1
}

/** A field of `count` leaves spread through the box around (cx, cz), at every height. */
export function createLeafField(count: number, cx: number, cz: number, rand: () => number): LeafField {
  const n = Math.max(0, Math.floor(count))
  const f: LeafField = {
    count: n,
    x: new Float32Array(n),
    y: new Float32Array(n),
    z: new Float32Array(n),
    fall: new Float32Array(n),
    flutterHz: new Float32Array(n),
    phase: new Float32Array(n),
    ground: new Float32Array(n),
    color: new Uint8Array(n),
  }
  for (let i = 0; i < n; i++) {
    spawnLeaf(f, i, cx, cz, rand, rand() * LEAVES.topM)
    f.fall[i] = between(rand, LEAVES.fallSpeed.min, LEAVES.fallSpeed.max)
    f.flutterHz[i] = between(rand, LEAVES.flutterHz.min, LEAVES.flutterHz.max)
    f.phase[i] = rand() * TAU
    f.color[i] = Math.floor(rand() * LEAVES.colors.length) % LEAVES.colors.length
    // Some start on the ground so the first look already has leaves lying about.
    if (rand() < LEAVES.startOnGround) {
      f.y[i] = 0
      f.ground[i] = between(rand, LEAVES.groundTimeS.min, LEAVES.groundTimeS.max)
    }
  }
  return f
}

/** Wind strength multiplier at time `t`: slow gusts between 1 - gust and 1 + gust. */
export function gustFactor(t: number): number {
  if (!Number.isFinite(t)) return 1
  return 1 + LEAVES.gust * Math.sin(TAU * LEAVES.gustHz * t)
}

/** Wrap `v` into the box of side `box` centred on `c`. */
export function wrapAround(v: number, c: number, box: number): number {
  const half = box / 2
  const d = v - c
  if (d >= -half && d <= half) return v
  return c + ((((d + half) % box) + box) % box) - half
}

/**
 * Move every leaf by `dt` seconds: falling ones drift with the wind and flutter, landed ones skate
 * slowly and then lift off again from the top of the box. Leaves stay in the box around the camera
 * (cx, cz) by wrapping, so the field follows the player without the landed leaves sliding along.
 */
export function stepLeaves(
  f: LeafField,
  dt: number,
  t: number,
  windScale: number,
  cx: number,
  cz: number,
  rand: () => number,
): void {
  if (!(dt > 0) || !Number.isFinite(dt)) return
  const gust = gustFactor(t) * (Number.isFinite(windScale) ? Math.max(0, windScale) : 1)
  const wx = LEAVES.wind.x * gust
  const wz = LEAVES.wind.z * gust
  for (let i = 0; i < f.count; i++) {
    if (f.ground[i] >= 0) {
      f.ground[i] -= dt
      f.x[i] += wx * LEAVES.groundDrag * dt
      f.z[i] += wz * LEAVES.groundDrag * dt
      if (f.ground[i] < 0) spawnLeaf(f, i, cx, cz, rand, LEAVES.topM * between(rand, LEAVES.relaunchFrom, 1))
    } else {
      const flutter = LEAVES.flutterM * TAU * f.flutterHz[i] * Math.cos(TAU * f.flutterHz[i] * t + f.phase[i])
      f.x[i] += (wx + flutter * LEAVES.flutterMix.x) * dt
      f.z[i] += (wz + flutter * LEAVES.flutterMix.z) * dt
      f.y[i] -= f.fall[i] * dt
      if (f.y[i] <= 0) {
        f.y[i] = 0
        f.ground[i] = between(rand, LEAVES.groundTimeS.min, LEAVES.groundTimeS.max)
      }
    }
    f.x[i] = wrapAround(f.x[i], cx, LEAVES.boxM)
    f.z[i] = wrapAround(f.z[i], cz, LEAVES.boxM)
  }
}

// --- Harvest moon ---------------------------------------------------------------

/** Unit vector from the viewer towards the moon. */
export function moonDirection(): readonly [number, number, number] {
  const [x, y, z] = HARVEST_MOON.direction
  const len = Math.hypot(x, y, z)
  return [x / len, y / len, z / len]
}

/** How much of the moon should show (0..1) for this phase, dimmed under storm cloud. */
export function moonShowTarget(phase: Phase, storm: boolean): number {
  const show = MOON_SHOW[phase] ?? 0
  return storm ? Math.min(show, HARVEST_MOON.stormShow) : show
}

/** Ease the moon's showing towards `target`, a full swing taking HARVEST_MOON.fadeS. */
export function easeMoonShow(current: number, target: number, dt: number): number {
  if (!(dt > 0) || !Number.isFinite(dt)) return current
  const step = dt / HARVEST_MOON.fadeS
  if (Math.abs(target - current) <= step) return target
  return current + Math.sign(target - current) * step
}

// --- Autumn ambience ------------------------------------------------------------

/** Wind bed level for a phase, 0..1. */
export function windLevel(phase: Phase): number {
  return AUTUMN_AMBIENCE.wind[phase] ?? 0
}

export interface AmbienceClock {
  /** Seconds until the next crow may call. */
  crowIn: number
  /** Seconds until the next set of bell tolls may start. */
  bellIn: number
  /** Tolls still to ring in the current set. */
  tollsLeft: number
  /** Seconds until the next toll of the current set. */
  tollIn: number
}

export type AmbienceCue =
  | { kind: 'crow'; angle: number; distanceM: number }
  | { kind: 'bell' }

export function createAmbienceClock(rand: () => number): AmbienceClock {
  return {
    crowIn: between(rand, AUTUMN_AMBIENCE.crowGapS.min, AUTUMN_AMBIENCE.crowGapS.max),
    bellIn: between(rand, AUTUMN_AMBIENCE.bellGapS.min, AUTUMN_AMBIENCE.bellGapS.max),
    tollsLeft: 0,
    tollIn: 0,
  }
}

/**
 * Advance the ambience clock by `dt` and return what should sound this frame. Crows call only in
 * the crow phases and the bell only at night; a timer that runs out in the wrong phase just waits
 * for its next gap. A set of tolls already started finishes even if the phase turns.
 */
export function stepAmbience(clock: AmbienceClock, dt: number, phase: Phase, rand: () => number): AmbienceCue[] {
  const cues: AmbienceCue[] = []
  if (!(dt > 0) || !Number.isFinite(dt)) return cues
  const A = AUTUMN_AMBIENCE

  clock.crowIn -= dt
  if (clock.crowIn <= 0) {
    clock.crowIn = between(rand, A.crowGapS.min, A.crowGapS.max)
    if (A.crowPhases.includes(phase)) {
      cues.push({ kind: 'crow', angle: rand() * TAU, distanceM: between(rand, A.crowDistanceM.min, A.crowDistanceM.max) })
    }
  }

  if (clock.tollsLeft > 0) {
    clock.tollIn -= dt
    if (clock.tollIn <= 0) {
      cues.push({ kind: 'bell' })
      clock.tollsLeft -= 1
      clock.tollIn = A.bellTollGapS
    }
  } else {
    clock.bellIn -= dt
    if (clock.bellIn <= 0) {
      clock.bellIn = between(rand, A.bellGapS.min, A.bellGapS.max)
      if (A.bellPhases.includes(phase)) {
        cues.push({ kind: 'bell' })
        clock.tollsLeft = A.bellTolls - 1
        clock.tollIn = A.bellTollGapS
      }
    }
  }
  return cues
}
