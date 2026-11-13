// Game store — top-level screen state machine and pause flag.
// Pure zustand, no React / three.js imports.

import { create } from 'zustand'
import type { Screen } from '../types'

interface GameStoreState {
  screen: Screen
  paused: boolean
  /** Examine mode is open: the simulation is frozen without showing the pause menu (Req 4.5). */
  examining: boolean
  setExamining: (examining: boolean) => void
  /** Journal (map) is open: the simulation is frozen like examine mode, without the pause menu. */
  journalOpen: boolean
  setJournalOpen: (open: boolean) => void
  /**
   * The big map (M) is open. It freezes the simulation like the journal, by day and at night
   * (the F8 night rule of spec 10 is not built yet, so night pauses too).
   */
  mapOpen: boolean
  setMapOpen: (open: boolean) => void
  /** Satchel overlay is open. Unlike journal/examine this never freezes the simulation (Req 5.5). */
  satchelOpen: boolean
  setSatchelOpen: (open: boolean) => void
  /** Player reached 0 HP: shows the "You were taken" screen and freezes the sim. */
  taken: boolean
  setTaken: (taken: boolean) => void
  /** Bumped by Retry Night so the health bar restarts without a drain animation. */
  retryEpoch: number
  setScreen: (screen: Screen) => void
  setPaused: (paused: boolean) => void
}

export const useGameStore = create<GameStoreState>((set) => ({
  screen: 'content-warning',
  paused: false,
  examining: false,
  setExamining: (examining) => set({ examining }),
  journalOpen: false,
  setJournalOpen: (journalOpen) => set({ journalOpen }),
  mapOpen: false,
  setMapOpen: (mapOpen) => set({ mapOpen }),
  satchelOpen: false,
  setSatchelOpen: (satchelOpen) => set({ satchelOpen }),
  taken: false,
  setTaken: (taken) => set({ taken }),
  retryEpoch: 0,
  setScreen: (screen) => set({ screen }),
  setPaused: (paused) => set({ paused }),
}))
