// Lantern hand run state kept across sessions (spec 11 H7, Req 7.5): whether the "Lantern hooked
// to your belt" caption has been shown this run. Saved in the progression save; New Game clears
// it (resetRun replaces this store), Continue restores it, and Retry Night / Retry from morning
// leave it alone (the Retry snapshot omits it).
import { create } from 'zustand'

interface LanternHandStore {
  hookCaptionShown: boolean
  setHookCaptionShown: (shown: boolean) => void
}

export const useLanternHandStore = create<LanternHandStore>((set) => ({
  hookCaptionShown: false,
  setHookCaptionShown: (hookCaptionShown) => set({ hookCaptionShown }),
}))
