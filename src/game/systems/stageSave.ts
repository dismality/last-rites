// Save shape and migration for the stage domain (spec 10). Pure: no stores, no React.

import { STAGE_COUNT, type StageNumber } from '../../data/stages'
import { INITIAL_ALTAR_STATE, type AltarState } from './altarAnswer'

/** What a save (and a snapshot) keeps of the stage store. */
export interface StageSave {
  stage: StageNumber
  caseSolved: boolean
  solvedAtPhaseTime: number | null
  nightElapsed: number
  altar: AltarState
}

/** Old night 1..5 -> stage 1, 1, 2, 2, 3 (the ladder rows each stage now owns). */
const OLD_NIGHT_TO_STAGE: readonly StageNumber[] = [1, 1, 2, 2, 3]

/** Monotone: a later old night never maps to an earlier stage. Junk maps to stage 1. */
export function stageOfOldNight(night: number): StageNumber {
  if (!Number.isFinite(night)) return 1
  const i = Math.min(Math.max(Math.floor(night), 1), OLD_NIGHT_TO_STAGE.length) - 1
  return OLD_NIGHT_TO_STAGE[i]
}

export function freshStageSave(stage: StageNumber): StageSave {
  return { stage, caseSolved: false, solvedAtPhaseTime: null, nightElapsed: 0, altar: INITIAL_ALTAR_STATE }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const num = (v: unknown, d: number, min = 0): number => (typeof v === 'number' && Number.isFinite(v) && v >= min ? v : d)

/** Reads the stage block of a save; junk gives a fresh block for `fallback`. Never throws. */
export function sanitizeStageSave(raw: unknown, fallback: StageNumber): StageSave {
  if (!isObj(raw)) return freshStageSave(fallback)
  const stage = raw.stage
  const altar = isObj(raw.altar) ? raw.altar : {}
  return {
    stage: stage === 1 || stage === 2 || stage === 3 ? stage : fallback,
    caseSolved: raw.caseSolved === true,
    solvedAtPhaseTime: raw.solvedAtPhaseTime === null ? null : num(raw.solvedAtPhaseTime, 0),
    nightElapsed: num(raw.nightElapsed, 0),
    altar: {
      lockedUntil: num(altar.lockedUntil, 0),
      wrong: Math.floor(num(altar.wrong, 0)),
      linksAtLastWrong: Math.floor(num(altar.linksAtLastWrong, 0)),
    },
  }
}

/**
 * Migrates a story save written before stages. Without a `stage` block the night number is mapped
 * to its stage and a fresh stage block is built; a save that has one keeps its night number
 * (clamped to the stages). Endless saves are not touched: they have no stages.
 */
export function migrateSave(
  world: { nightNumber: number },
  rawStage: unknown,
  story: boolean,
): { nightNumber: number; stage: StageSave } {
  if (!story) return { nightNumber: world.nightNumber, stage: sanitizeStageSave(rawStage, 1) }
  if (isObj(rawStage)) {
    const n = Math.min(Math.max(Math.floor(num(world.nightNumber, 1, 1)), 1), STAGE_COUNT) as StageNumber
    return { nightNumber: n, stage: sanitizeStageSave(rawStage, n) }
  }
  const stage = stageOfOldNight(world.nightNumber)
  return { nightNumber: stage, stage: freshStageSave(stage) }
}
