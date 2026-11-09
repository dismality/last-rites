// Active timed effects (Blessed Rounds, Adrenaline, Salt Circle). Rules are in systems/effects.ts.
import { create } from 'zustand'
import type { ActiveEffect } from '../systems/effects'

interface EffectStoreState {
  effects: readonly ActiveEffect[]
  setEffects: (effects: readonly ActiveEffect[]) => void
  clear: () => void
}

export const useEffectStore = create<EffectStoreState>((set) => ({
  effects: [],
  setEffects: (effects) => set({ effects }),
  clear: () => set({ effects: [] }),
}))
