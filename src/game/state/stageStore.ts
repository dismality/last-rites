// Stage domain store (spec 10): which stage the story is in, whether its case is solved, how long
// the night has run and the altar's answer state. The world clock (`worldStore.nightNumber`) stays
// the source of the stage number; this store follows it and holds what the clock does not.
// Pure zustand: no React / three.js imports.

import { create } from 'zustand'
import { STAGE_COUNT, type StageNumber } from '../../data/stages'
import { giveAnswer, INITIAL_ALTAR_STATE, type AltarState, type AltarVerdict } from '../systems/altarAnswer'
import { markCaseSolved, startStage, tickStageNight } from '../systems/stage'
import { queueWaveNow } from '../systems/waves'
import { emitCombatSound } from './combatSounds'
import { useWaveStore } from './waveStore'
import { useWorldStore } from './worldStore'

/** Stage number for a world night number: story nights are the stage, clamped to 1..3. */
export function stageOfNight(nightNumber: number): StageNumber {
  const n = Number.isFinite(nightNumber) ? Math.floor(nightNumber) : 1
  return Math.min(Math.max(n, 1), STAGE_COUNT) as StageNumber
}

interface StageStoreState {
  stage: StageNumber
  caseSolved: boolean
  /** Night `phaseTime` (s) when the case was solved; null while unsolved. */
  solvedAtPhaseTime: number | null
  /** Seconds the current night has run. The altar lock is measured on this clock. */
  nightElapsed: number
  altar: AltarState
  /** Begin a stage afresh (new day): unsolved, clock at zero, altar forgets earlier answers. */
  startStage: (stage: StageNumber) => void
  /** A night begins: the clock and any altar lock restart; wrong-answer counts are kept. */
  beginNight: () => void
  /** Clears what belongs to one night's fight (death, retry): solved flag, clock and lock. */
  resetNight: () => void
  solveCase: (phaseTime?: number) => void
  tick: (dt: number) => void
  /**
   * Give the altar an answer. `correct` comes from the case data (task 2); here it is injected.
   * A wrong case answer queues an instant wave and locks the altar; a correct one solves the case.
   */
  giveAltarAnswer: (correct: boolean, linksNow: number, kind: 'case' | 'accusation') => AltarVerdict
}

const fresh = (stage: StageNumber) => {
  const s = startStage(stage)
  return { ...s, altar: INITIAL_ALTAR_STATE }
}

export const useStageStore = create<StageStoreState>((set, get) => ({
  ...fresh(1),
  startStage: (stage) => set(fresh(stage)),
  beginNight: () =>
    set((s) => ({
      caseSolved: false,
      solvedAtPhaseTime: null,
      nightElapsed: 0,
      altar: { ...s.altar, lockedUntil: 0 },
    })),
  resetNight: () =>
    set((s) => ({
      caseSolved: false,
      solvedAtPhaseTime: null,
      nightElapsed: 0,
      altar: { ...s.altar, lockedUntil: 0 },
    })),
  solveCase: (phaseTime = useWorldStore.getState().phaseTime) =>
    set((s) => {
      const next = markCaseSolved(s, phaseTime)
      return next === s ? s : { caseSolved: next.caseSolved, solvedAtPhaseTime: next.solvedAtPhaseTime }
    }),
  tick: (dt) =>
    set((s) => {
      const next = tickStageNight(s, dt)
      return next === s ? s : { nightElapsed: next.nightElapsed }
    }),
  giveAltarAnswer: (correct, linksNow, kind) => {
    const s = get()
    const phase = useWorldStore.getState().phase
    const verdict = giveAnswer(s.altar, s.nightElapsed, phase, linksNow, correct, kind)
    if (verdict.kind === 'solved') get().solveCase()
    else if (verdict.kind === 'wrong') {
      set({ altar: verdict.state })
      const waves = useWaveStore.getState()
      waves.setWaves(queueWaveNow(waves.waves))
      emitCombatSound('altar-wrong')
    } else if (verdict.kind === 'locked') emitCombatSound('altar-locked')
    // The clear note of a solved case is raised by the case-solved watcher, for every way of solving.
    return verdict
  },
}))

/** Data fields a snapshot or save keeps (functions are never captured). */
export const STAGE_PERSISTED = ['stage', 'caseSolved', 'solvedAtPhaseTime', 'nightElapsed', 'altar'] as const

/** Story only ticks while the story night runs; Endless never reads this store. */
export function tickStageClock(dt: number): void {
  if (useWorldStore.getState().phase !== 'night') return
  useStageStore.getState().tick(dt)
}

// The world clock moves the stage on: when the night number maps to another stage (dawn -> day),
// the new stage starts fresh. Loads restore this store after the world, so they win.
useWorldStore.subscribe((w, prev) => {
  if (w.nightNumber === prev.nightNumber) return
  const stage = stageOfNight(w.nightNumber)
  if (stage !== useStageStore.getState().stage) useStageStore.getState().startStage(stage)
})
