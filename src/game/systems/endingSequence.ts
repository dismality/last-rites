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

/**
 * Longest single step the clock accepts. This was 0.1 s, which made a slow frame rate stretch the
 * sequence (a 36 s ending took over 70 s at ~5 fps). It now only guards against a huge jump after
 * the tab was hidden, so the sequence follows real time.
 */
export const MAX_SEQUENCE_STEP_S = 1

/**
 * One tick of the sequence clock. A pause holds the time (so the end is delayed, never lost) and
 * the sequence is done when the time reaches the duration, with no dependency on Skip.
 */
export function advanceSequence(
  def: EndingDef,
  time: number,
  dt: number,
  paused = false,
): { time: number; done: boolean } {
  const step = paused || !Number.isFinite(dt) ? 0 : Math.min(Math.max(dt, 0), MAX_SEQUENCE_STEP_S)
  const next = Math.min(time + step, def.duration)
  return { time: next, done: next >= def.duration }
}

export function isSequenceDone(def: EndingDef, t: number): boolean {
  return t >= def.duration
}

/**
 * Escape, Space and Enter skip the sequence. The default action is cancelled on purpose: skipping mounts
 * the summary and moves focus to its first button, and an uncancelled Enter would then click that button
 * (sending the player straight back to the title).
 */
export function handleSkipKey(e: { key: string; preventDefault: () => void }, skip: () => void): boolean {
  if (e.key !== 'Escape' && e.key !== ' ' && e.key !== 'Enter') return false
  e.preventDefault()
  skip()
  return true
}
