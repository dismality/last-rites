// Ending state: run stats, whether the final rite has begun, and which ending is playing.
// Pure zustand, no React / three.js imports.

import { create } from 'zustand'
import { subscribeToType } from '../events'
import type { EndingId } from '../types'
import { finalizeStats, recordNightSurvived } from '../systems/runStats'
import { updateRunStats } from './statsPort'

/**
 * epilogue = the Justice for Elias card, shown before the walk-out (spec 10, Req 18.3);
 * sequence = camera path playing; walkout = the win cutscene after the Rest sunrise (spec 10,
 * Req 23); summary = the ending card, stats, credits and the exit buttons.
 */
export type EndingStage = 'epilogue' | 'sequence' | 'walkout' | 'summary'

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
  beginEnding: (ending: EndingId, epilogue?: boolean) => void
  /** The epilogue card is read (or skipped): the sequence begins. */
  endEpilogue: () => void
  /** The sequence ends (or is skipped): a won run walks out, any other goes to the summary. */
  endSequence: () => void
  showSummary: () => void
  /** Dev and tests: straight to the win walk-out of a Rest ending already begun. */
  playWalkout: () => void
  reset: () => void
}

const INITIAL = {
  runId: 0,
  nightFiveCleared: false,
  riteStarted: false,
  ending: null,
  stage: 'sequence' as EndingStage,
}

/** Esc pauses on the ending screen only over the epilogue card and the win walk-out (Req 23.4). */
export function endingPausable(): boolean {
  const stage = useEndingStore.getState().stage
  return stage === 'epilogue' || stage === 'walkout'
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
  beginEnding: (ending, epilogue = false) => {
    writeStats((s) => finalizeStats(s, ending))
    set({ ending, stage: epilogue ? 'epilogue' : 'sequence' })
  },
  endEpilogue: () => set((s) => (s.stage === 'epilogue' ? { stage: 'sequence' } : s)),
  endSequence: () =>
    set((s) => (s.stage === 'sequence' ? { stage: s.ending === 'rest' ? 'walkout' : 'summary' } : s)),
  showSummary: () => set({ stage: 'summary' }),
  playWalkout: () => set((s) => (s.ending === 'rest' ? { stage: 'walkout' } : s)),
  reset: () => set({ ...INITIAL, runId: get().runId + 1 }),
}))
