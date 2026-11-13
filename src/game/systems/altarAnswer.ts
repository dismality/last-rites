import type { Phase } from '../types'

/** Seconds the altar stays silent after a wrong case answer (bible §13). */
export const ALTAR_LOCK_S = 30

/** Wrong answers on one case before a new board link is required. */
export const WRONG_BEFORE_LINK = 2

export interface AltarState {
  /** Sim time (s) until which the altar rejects answers. */
  lockedUntil: number
  /** Wrong case answers given on this case. */
  wrong: number
  /** Board link count when the latest wrong answer was given. */
  linksAtLastWrong: number
}

export type AltarVerdict =
  | { kind: 'solved' }
  | { kind: 'wrong'; state: AltarState; spawnWave: true }
  /** A wrong Stage 3 accusation: no wave, no lock, state untouched. */
  | { kind: 'wrong-accusation' }
  | { kind: 'locked'; secondsLeft: number }
  | { kind: 'needs-link' }
  | { kind: 'day' }

export const INITIAL_ALTAR_STATE: AltarState = { lockedUntil: 0, wrong: 0, linksAtLastWrong: 0 }

/**
 * Decide what the altar does with an answer. The verdict `correct` is injected
 * so this stays independent of the case data (the real check lives in caseAnswer).
 * The altar only listens at night; dusk and dawn count as "not now" like day.
 */
export function giveAnswer(
  a: AltarState,
  now: number,
  phase: Phase,
  linksNow: number,
  correct: boolean,
  kind: 'case' | 'accusation',
): AltarVerdict {
  if (phase !== 'night') return { kind: 'day' }
  if (now < a.lockedUntil) return { kind: 'locked', secondsLeft: Math.ceil(a.lockedUntil - now) }
  // The link rule guards the case answer only; an accusation is not brute-forceable the same way
  // and costs nothing when wrong.
  if (kind === 'case' && a.wrong >= WRONG_BEFORE_LINK && linksNow <= a.linksAtLastWrong) {
    return { kind: 'needs-link' }
  }
  if (correct) return { kind: 'solved' }
  if (kind === 'accusation') return { kind: 'wrong-accusation' }
  return {
    kind: 'wrong',
    spawnWave: true,
    state: { lockedUntil: now + ALTAR_LOCK_S, wrong: a.wrong + 1, linksAtLastWrong: linksNow },
  }
}
