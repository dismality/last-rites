// Day/night world state — drives the GameLoop phase transitions.
// Pure zustand, no React / three.js imports.

import { create } from 'zustand'
import type { WorldState } from '../types'

interface WorldStoreState extends WorldState {
  setPhase: (phase: WorldState['phase']) => void
  setPhaseTime: (t: number) => void
  setNightNumber: (n: number) => void
  setFogDensity: (d: number) => void
  setWavesCleared: (b: boolean) => void
  applyWorldState: (state: Partial<WorldState>) => void
}

export const useWorldStore = create<WorldStoreState>((set) => ({
  phase: 'day',
  phaseTime: 0,
  nightNumber: 1,
  fogDensity: 0.02,
  wavesCleared: false,
  setPhase: (phase) => set({ phase }),
  setPhaseTime: (t) => set({ phaseTime: t }),
  setNightNumber: (n) => set({ nightNumber: n }),
  setFogDensity: (d) => set({ fogDensity: d }),
  setWavesCleared: (b) => set({ wavesCleared: b }),
  applyWorldState: (s) => set(s),
}))
