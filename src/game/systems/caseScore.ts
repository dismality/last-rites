// Doubt and Sharp Eye (spec 10 task 2.2, Req 9.4-9.6, 9.9). Pure.

import { DOUBT_MAX } from '../../data/stages'

/** Score taken for each wrong day answer (Req 9.4). */
export const DOUBT_SCORE_PENALTY = 50
/** Score for a case solved with no hint and no wrong answer (Req 9.6). */
export const SHARP_EYE_BONUS = 300

export interface DoubtState {
  /** The night (stage) the doubt was earned in. */
  nightId: number
  doubt: number
}

export const INITIAL_DOUBT: DoubtState = { nightId: 0, doubt: 0 }

/** A wrong day answer adds 1 Doubt, at most DOUBT_MAX a night. A new night starts again at 1. */
export function applyDoubt(d: DoubtState, nightId: number): DoubtState {
  const base = d.nightId === nightId ? d.doubt : 0
  return { nightId, doubt: Math.min(DOUBT_MAX, Math.max(0, base) + 1) }
}

/** Doubt that counts for the night that is starting: one extra Shambler each (Req 9.5). */
export function doubtForNight(d: DoubtState, nightId: number): number {
  return d.nightId === nightId ? Math.min(DOUBT_MAX, Math.max(0, d.doubt)) : 0
}

/** 300 only when no hint was used and no wrong answer was given, day or altar. */
export function sharpEye(h: { hintsUsed: number; wrongAnswers: number }): number {
  return h.hintsUsed === 0 && h.wrongAnswers === 0 ? SHARP_EYE_BONUS : 0
}
