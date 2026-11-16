// Wave director state, mirrored for the HUD tally and the scene.
import { create } from 'zustand'
import { createWaveState, type WaveState } from '../systems/waves'
import type { GlowingGrave } from '../systems/nameTheDead'

interface WaveStoreState {
  waves: WaveState
  /** Total waves in the current night (for the tally). */
  totalWaves: number
  /** Name the Dead (spec 10 task 11): the grave glowing with a name this wave, or null. */
  glow: GlowingGrave | null
  /** The grave sealed by naming, and the wave it stays shut for. */
  sealed: { graveId: string; wave: number } | null
  setWaves: (waves: WaveState) => void
  setTotalWaves: (n: number) => void
  setGlow: (glow: GlowingGrave | null) => void
  /** Seals a grave for one wave (Req 28.2). */
  seal: (graveId: string, wave: number) => void
  reset: () => void
}

const sameGlow = (a: GlowingGrave | null, b: GlowingGrave | null): boolean =>
  a === b || (a !== null && b !== null && a.graveId === b.graveId && a.name === b.name && a.wave === b.wave)

export const useWaveStore = create<WaveStoreState>((set, get) => ({
  waves: createWaveState(),
  totalWaves: 0,
  glow: null,
  sealed: null,
  setWaves: (waves) => set({ waves }),
  setTotalWaves: (totalWaves) => set({ totalWaves }),
  // Set every frame by the wave director; skip no-op writes.
  setGlow: (glow) => {
    if (!sameGlow(get().glow, glow)) set({ glow })
  },
  seal: (graveId, wave) => set({ sealed: { graveId, wave } }),
  reset: () => set({ waves: createWaveState(), totalWaves: 0, glow: null, sealed: null }),
}))
