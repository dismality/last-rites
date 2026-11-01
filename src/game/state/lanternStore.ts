// Lantern state store — on/off switch, fuel level, and flicker flag.
// Pure zustand, no React / three.js imports.

import { create } from 'zustand'
import type { LanternState } from '../types'

interface LanternStoreState extends LanternState {
  setOn: (on: boolean) => void
  setFuel: (fuel: number) => void
  setFlicker: (flicker: boolean) => void
  applyLanternState: (state: Partial<LanternState>) => void
}

export const useLanternStore = create<LanternStoreState>((set) => ({
  on: true,
  fuel: 100,
  flicker: false,
  setOn: (on) => set({ on }),
  setFuel: (fuel) => set({ fuel }),
  setFlicker: (flicker) => set({ flicker }),
  applyLanternState: (s) => set(s),
}))
