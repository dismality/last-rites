// Viewmodel animation maths: swap (lower/raise), mouse sway and walking bob.
// Pure TypeScript (no React / three.js) so the curves can be tested in Node.
// Requirements 1.2, 1.3.

import type { ItemId } from '../types'
import { HEAD_BOB_AMPLITUDE, type BobState } from './movement'

/** Full lower + raise takes 0.3 s (Req 1.2): half to lower, half to raise. */
export const SWAP_DURATION = 0.3
/** How far below the rest pose the item drops when fully lowered (m). */
export const SWAP_LOWER_DISTANCE = 0.35
/** Tilt applied while lowered (rad), so the item rolls out of view rather than sliding. */
export const SWAP_LOWER_TILT = 0.5

// ---------------------------------------------------------------------------
// Swap
// ---------------------------------------------------------------------------

export interface SwapState {
  /** Item currently drawn. Changes only while fully lowered. */
  shown: ItemId | null
  /** 0 = fully raised, 1 = fully lowered. */
  progress: number
}

export function createSwapState(shown: ItemId | null): SwapState {
  return { shown, progress: 0 }
}

/**
 * Advance the swap toward `target`. If the target differs from what is shown the
 * item lowers, swaps at the bottom, then raises. Retargeting mid-swap simply
 * reverses direction from the current height, so rapid key presses never pop.
 */
export function tickSwap(s: SwapState, target: ItemId | null, dt: number): SwapState {
  const step = (dt * 2) / SWAP_DURATION
  if (s.shown !== target) {
    const progress = Math.min(1, s.progress + step)
    // Swap the drawn item the moment it is out of sight.
    return progress >= 1 ? { shown: target, progress: 1 } : { shown: s.shown, progress }
  }
  return { shown: s.shown, progress: Math.max(0, s.progress - step) }
}

/** Ease-in-out so the item doesn't jerk at the ends of the motion. */
export function swapEase(progress: number): number {
  const p = Math.min(1, Math.max(0, progress))
  return p * p * (3 - 2 * p)
}

// ---------------------------------------------------------------------------
// Sway (spring following look delta)
// ---------------------------------------------------------------------------

export const SWAY_STIFFNESS = 90
export const SWAY_DAMPING = 12
/** Metres of velocity kick per radian of look movement. */
export const SWAY_IMPULSE = 6
/** Hard limit so a fast flick can't drag the item out of frame (m). */
export const SWAY_MAX = 0.05

export interface SwayState {
  x: number
  y: number
  vx: number
  vy: number
}

export const SWAY_REST: SwayState = { x: 0, y: 0, vx: 0, vy: 0 }

const clamp = (v: number, limit: number): number => Math.min(limit, Math.max(-limit, v))

/**
 * Spring-damped sway. Looking right (yaw decreases per movement.ts, so we take
 * the signed change as given) drags the item the opposite way, then it settles.
 * `dYaw` / `dPitch` are this frame's camera rotation changes in radians.
 */
export function tickSway(s: SwayState, dYaw: number, dPitch: number, dt: number): SwayState {
  if (dt <= 0) return s
  // Turning left (dYaw > 0) pushes the item right; looking up pushes it down.
  let vx = s.vx + dYaw * SWAY_IMPULSE
  let vy = s.vy - dPitch * SWAY_IMPULSE
  vx += (-SWAY_STIFFNESS * s.x - SWAY_DAMPING * vx) * dt
  vy += (-SWAY_STIFFNESS * s.y - SWAY_DAMPING * vy) * dt
  return {
    x: clamp(s.x + vx * dt, SWAY_MAX),
    y: clamp(s.y + vy * dt, SWAY_MAX),
    vx,
    vy,
  }
}

// ---------------------------------------------------------------------------
// Walking bob
// ---------------------------------------------------------------------------

export interface BobOffset {
  x: number
  y: number
}

/**
 * Figure-of-eight bob: vertical at the step rate, horizontal at half of it.
 * Amplitude is already zero when head bob is disabled or the player stands
 * still (see tickHeadBob), so this needs no settings knowledge.
 */
export function viewmodelBob(b: BobState): BobOffset {
  const scale = b.amplitude / HEAD_BOB_AMPLITUDE
  return {
    x: Math.sin(b.phase * 0.5) * 0.012 * scale,
    y: Math.abs(Math.sin(b.phase)) * -0.015 * scale,
  }
}
