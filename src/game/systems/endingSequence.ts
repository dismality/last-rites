// Timeline maths for the ending camera sequences. Pure: the scene turns the result into a pose.

import type { EndingDef, EndingLine } from '../../data/endings'

/** Seconds of black at both ends of a sequence. */
export const FADE_S = 1.5

/** Smoothstep: slow in, slow out, so the camera never starts or stops abruptly. */
export function easeInOut(t: number): number {
  const c = Math.min(Math.max(t, 0), 1)
  return c * c * (3 - 2 * c)
}

/** 0..1 position along the camera curves at time `t`. */
export function cameraProgress(def: EndingDef, t: number): number {
  return easeInOut(t / def.duration)
}

/** The subtitle line visible at time `t`, or null between lines. */
export function activeLine(def: EndingDef, t: number): EndingLine | null {
  return def.lines.find((l) => t >= l.at && t < l.at + l.hold) ?? null
}

/** Black overlay opacity: fades in from black, then out to black at the end. */
export function fadeAlpha(def: EndingDef, t: number): number {
  const fadeIn = 1 - Math.min(Math.max(t / FADE_S, 0), 1)
  const fadeOut = 1 - Math.min(Math.max((def.duration - t) / FADE_S, 0), 1)
  return Math.max(fadeIn, fadeOut)
}

export function isSequenceDone(def: EndingDef, t: number): boolean {
  return t >= def.duration
}
