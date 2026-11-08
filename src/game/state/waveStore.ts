// Wave director state, mirrored for the HUD tally and the scene.
import { create } from 'zustand'
import { createWaveState, type WaveState } from '../systems/waves'

interface WaveStoreState {
  waves: WaveState
  /** Total waves in the current night (for the tally). */
  totalWaves: number
  setWaves: (waves: WaveState) => void
  setTotalWaves: (n: number) => void
  reset: () => void
}

export const useWaveStore = create<WaveStoreState>((set) => ({
  waves: createWaveState(),
  totalWaves: 0,
  setWaves: (waves) => set({ waves }),
  setTotalWaves: (totalWaves) => set({ totalWaves }),
  reset: () => set({ waves: createWaveState(), totalWaves: 0 }),
}))
