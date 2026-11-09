// Ending state: run stats, whether the final rite has begun, and which ending is playing.
// Pure zustand, no React / three.js imports.

import { create } from 'zustand'
import { subscribeToType } from '../events'
import type { EndingId } from '../types'
import { finalizeStats, recordNightSurvived } from '../systems/runStats'
import { updateRunStats } from './statsPort'

/** sequence = camera path playing; summary = stats, credits and the exit buttons. */
export type EndingStage = 'sequence' | 'summary'

interface EndingStoreState {
  /** Bumped on every reset; the scene is keyed on it so the player body returns to spawn. */
  runId: number
  /** Night 5's waves are cleared. Held here, not in worldStore, so night 5 does not drift to dawn. */
  nightFiveCleared: boolean
  /** The player has begun the rite (the chapel door no longer holds). */
  riteStarted: boolean
  ending: EndingId | null
  stage: EndingStage
  surviveNight: (night: number) => void
  setNightFiveCleared: (v: boolean) => void
  setRiteStarted: (v: boolean) => void
  /** Locks in the ending; stats are finalised so the summary matches it. */
  beginEnding: (ending: EndingId) => void
  showSummary: () => void
  reset: () => void
}

const INITIAL = {
  runId: 0,
  nightFiveCleared: false,
  riteStarted: false,
  ending: null,
  stage: 'sequence' as EndingStage,
}

/** Counts a night as survived when its dawn arrives. Returns the unsubscribe function. */
export function installRunStats(): () => void {
  return subscribeToType('dawnStarted', (e) => useEndingStore.getState().surviveNight(e.nightNumber))
}

/** Run stats live in progressionStore; the ending only transforms them. */
const writeStats = updateRunStats

export const useEndingStore = create<EndingStoreState>((set, get) => ({
  ...INITIAL,
  surviveNight: (night) => writeStats((s) => recordNightSurvived(s, night)),
  setNightFiveCleared: (nightFiveCleared) => set({ nightFiveCleared }),
  setRiteStarted: (riteStarted) => set({ riteStarted }),
  beginEnding: (ending) => {
    writeStats((s) => finalizeStats(s, ending))
    set({ ending, stage: 'sequence' })
  },
  showSummary: () => set({ stage: 'summary' }),
  reset: () => set({ ...INITIAL, runId: get().runId + 1 }),
}))
