// Keeper's hunch state (spec 10 task 7): the clock of day play since the last clue and the clue the
// lantern flame leans toward. Ticked in guidanceTick; read by the HUD flame. Pure zustand.

import { create } from 'zustand'
import { freshHunchClock, type HunchCandidate, type HunchClock } from '../systems/keeperHunch'

interface HunchStoreState {
  clock: HunchClock
  /** The nearest unfound clue while the hunch is on; null otherwise. */
  target: HunchCandidate | null
  set: (clock: HunchClock, target: HunchCandidate | null) => void
  /** Dev and tests: as if `seconds` of day play had passed without a clue. */
  skip: (seconds: number) => void
  reset: () => void
}

export const useHunchStore = create<HunchStoreState>((set) => ({
  clock: freshHunchClock(),
  target: null,
  set: (clock, target) =>
    set((s) => (s.clock === clock && s.target?.id === target?.id && s.target?.position === target?.position ? s : { clock, target })),
  skip: (seconds) => set((s) => ({ clock: { ...s.clock, sinceClueS: s.clock.sinceClueS + Math.max(0, seconds) } })),
  reset: () => set({ clock: freshHunchClock(), target: null }),
}))
