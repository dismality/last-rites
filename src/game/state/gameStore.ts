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
  /** Satchel overlay is open. Unlike journal/examine this never freezes the simulation (Req 5.5). */
  satchelOpen: boolean
  setSatchelOpen: (open: boolean) => void
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
  satchelOpen: false,
  setSatchelOpen: (satchelOpen) => set({ satchelOpen }),
  setScreen: (screen) => set({ screen }),
  setPaused: (paused) => set({ paused }),
}))
