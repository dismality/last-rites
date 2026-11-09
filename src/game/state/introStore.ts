// Intro cutscene state: is it playing, and has this run seen it.
// Pure zustand, no React / three.js imports.
// skip()/finish() refresh guidance so the first objective is in the tracker on the first
// frame after the intro.

import { create } from 'zustand'
import { refreshGuidance } from './guidanceTick'

interface IntroStoreState {
  playing: boolean
  seen: boolean
  /** Starts the intro; a new run has not seen it yet. */
  begin: () => void
  skip: () => void
  finish: () => void
  /** Restores `seen` from a save without playing anything. */
  setSeen: (seen: boolean) => void
}

export const useIntroStore = create<IntroStoreState>((set) => ({
  playing: false,
  seen: false,
  begin: () => set({ playing: true, seen: false }),
  // Idempotent: ending an intro that is not playing leaves state unchanged.
  skip: () => {
    set({ playing: false, seen: true })
    refreshGuidance()
  },
  finish: () => {
    set({ playing: false, seen: true })
    refreshGuidance()
  },
  setSeen: (seen) => set({ seen }),
}))
