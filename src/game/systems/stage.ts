// Stage state machine (spec 10): three stages, each one day, dusk, endless night and dawn.
// Pure TypeScript: no React, three.js or Howler imports.

import { STAGE_COUNT, type StageNumber } from '../../data/stages'
import type { DayNightInput } from './dayNight'

export interface StageState {
  stage: StageNumber
  caseSolved: boolean
  /** Night `phaseTime` (s) when the case was solved; null while unsolved. */
  solvedAtPhaseTime: number | null
  /** Seconds the current night has run. */
  nightElapsed: number
}

export function startStage(stage: StageNumber): StageState {
  return { stage, caseSolved: false, solvedAtPhaseTime: null, nightElapsed: 0 }
}

/** Solving twice keeps the first time. */
export function markCaseSolved(s: StageState, phaseTime: number): StageState {
  if (s.caseSolved) return s
  return { ...s, caseSolved: true, solvedAtPhaseTime: Math.max(0, phaseTime) }
}

/** The stage after this one, or 'win' once stage 3 is done. */
export function nextStage(s: StageState): StageState | 'win' {
  return s.stage >= STAGE_COUNT ? 'win' : startStage((s.stage + 1) as StageNumber)
}

/** Night is over exactly when the case is solved (the world clock still calls this `wavesCleared`). */
export function wavesClearedFor(s: StageState): boolean {
  return s.caseSolved
}

/** Counts night time; a solved case stops the clock. */
export function tickStageNight(s: StageState, dt: number): StageState {
  if (s.caseSolved || dt <= 0) return s
  return { ...s, nightElapsed: s.nightElapsed + dt }
}

/** Day/night input for a stage: the case-solved flag ends the night and the last night is stage 3. */
export function stageDayNightInput(s: StageState, rest: Omit<DayNightInput, 'wavesCleared' | 'lastNight'> = {}): DayNightInput {
  return { ...rest, wavesCleared: wavesClearedFor(s), caseSolved: s.caseSolved, lastNight: STAGE_COUNT }
}
