// Game store — top-level screen state machine and pause flag.
// Pure zustand, no React / three.js imports.

import { create } from 'zustand'
import type { Screen } from '../types'

interface GameStoreState {
  screen: Screen
  paused: boolean
  setScreen: (screen: Screen) => void
  setPaused: (paused: boolean) => void
}

export const useGameStore = create<GameStoreState>((set) => ({
  screen: 'content-warning',
  paused: false,
  setScreen: (screen) => set({ screen }),
  setPaused: (paused) => set({ paused }),
}))
