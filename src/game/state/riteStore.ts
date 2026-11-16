// Rite domain store (spec 10 task 4.5, Req 17): the relics standing on the altar and the actions
// that place them. The rules are the pure functions in systems/rite.ts; this store wires them to
// the altar lock (stageStore), the wrong-answer penalty (caseStore), Crane's rising clock
// (endingStore.riteStarted, read by the boss director) and the end of the night.
// Rite state belongs to one night, like Crane himself: Retry Night and a new run clear it, and it
// is not saved (the autosaves fall at dawn and dusk, when nothing stands on the altar).
// Pure zustand: no React / three.js imports.

import { create } from 'zustand'
import { RITE_ORDER } from '../../data/relics'
import type { RelicId } from '../types'
import type { AltarVerdict } from '../systems/altarAnswer'
import { riteBlocked } from '../systems/bossDirector'
import { riteAvailability } from '../systems/finalRite'
import { EMPTY_RITE, isRiteDone, placeRelic, type RiteState } from '../systems/rite'
import { useBossStore } from './bossStore'
import { useCaseStore } from './caseStore'
import { useChapelStore } from './chapelStore'
import { emitCombatSound } from './combatSounds'
import { useEndingStore } from './endingStore'
import { useInventoryStore } from './inventoryStore'
import { useMysteryStore } from './mysteryStore'
import { riteFinalNight } from './riteStatus'
import { startEnding } from './startEnding'
import { useStageStore } from './stageStore'
import { useWorldStore } from './worldStore'

export type PlaceOutcome =
  /** The relic stays. `startsRisingClock` is true for the first one; `complete` ends the run. */
  | { kind: 'placed'; startsRisingClock: boolean; complete: boolean }
  /** Wrong slot: the relic stays in the satchel and the altar judged it a wrong answer. */
  | { kind: 'wrong'; verdict: AltarVerdict }
  /** The altar is silent after an earlier wrong note. */
  | { kind: 'locked'; secondsLeft: number }
  /** The slot is taken, or the relic is already on the altar. */
  | { kind: 'refused' }
  /** The player does not hold that relic. */
  | { kind: 'not-held' }
  /** Not the last stage's night, or the case is already solved. */
  | { kind: 'unavailable' }

interface RiteStoreState {
  rite: RiteState
  /** Put `relic` in `slot` (0 is the first relic of the rite). */
  place: (slot: number, relic: RelicId) => PlaceOutcome
  /**
   * Finish the rite when all five stand in order and Father Crane has fallen (Req 17.5). Called
   * after each placement and every sim step, because Crane may fall after the last relic.
   * Returns true on the call that finishes it.
   */
  tryComplete: () => boolean
  reset: () => void
}

/** The relic is in the satchel or on the mystery record. */
export function holdsRelic(relic: RelicId): boolean {
  return (
    useInventoryStore.getState().inventory.relics.includes(relic) ||
    useMysteryStore.getState().mystery.relics.has(relic)
  )
}

/** The rite can be worked on now: the last stage's night, case not yet solved. */
export function riteOpen(): boolean {
  const w = useWorldStore.getState()
  return (
    riteAvailability({ nightNumber: w.nightNumber, phase: w.phase, finalNight: riteFinalNight() }) === 'ready' &&
    !useStageStore.getState().caseSolved
  )
}

export const useRiteStore = create<RiteStoreState>((set, get) => ({
  rite: EMPTY_RITE,

  place: (slot, relic) => {
    if (!riteOpen()) return { kind: 'unavailable' }
    if (!holdsRelic(relic)) return { kind: 'not-held' }
    const stage = useStageStore.getState()
    if (stage.nightElapsed < stage.altar.lockedUntil) {
      emitCombatSound('altar-locked')
      return { kind: 'locked', secondsLeft: Math.ceil(stage.altar.lockedUntil - stage.nightElapsed) }
    }
    const craneAlive = riteBlocked(useBossStore.getState().boss)
    const res = placeRelic(get().rite, slot, relic, RITE_ORDER, craneAlive)
    if (res.outcome === 'refused') return { kind: 'refused' }
    if (res.outcome === 'wrong') {
      // The altar's answer-lock rules apply (Req 17.3): a sour note, an instant wave, a 30 s lock.
      return { kind: 'wrong', verdict: useCaseStore.getState().misplaceRelic() }
    }
    set({ rite: res.state })
    emitCombatSound('relic-placed')
    if (res.startsRisingClock) {
      // Father Crane's 10 s clock counts from here (the boss director reads `riteStarted`), and
      // the chapel doors stop holding, as in the old rite.
      useEndingStore.getState().setRiteStarted(true)
      useChapelStore.getState().setFinalRiteActive(true)
    }
    return { kind: 'placed', startsRisingClock: res.startsRisingClock, complete: get().tryComplete() }
  },

  tryComplete: () => {
    if (!riteOpen()) return false
    if (!isRiteDone(get().rite, RITE_ORDER, riteBlocked(useBossStore.getState().boss))) return false
    // Solving the case lifts the curse, scores the night and closes the case; the Rest ending
    // follows at once until the win cutscene (task 5) takes over the walk out.
    useStageStore.getState().solveCase()
    startEnding('rest')
    return true
  },

  reset: () => set({ rite: EMPTY_RITE }),
}))

// Everything that ends a night's fight (Retry Night, death, a new run, the ending) clears
// `riteStarted`, so the altar empties with it. Following that flag keeps this store out of
// `nightState`, which `startEnding` (imported above) already imports.
useEndingStore.subscribe((s, prev) => {
  if (prev.riteStarted && !s.riteStarted) useRiteStore.getState().reset()
})
