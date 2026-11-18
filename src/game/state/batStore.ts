// The bats that watch the player (spec 11 H4). Rules: systems/bats.ts; the step is batStep.ts.
// Saved with the world (gameSave.ts) and replaced wholesale by New Game (resetRun.ts).
import { create } from 'zustand'
import type { Bat } from '../systems/bats'
import type { BatSave } from '../systems/batSave'

export interface BatEntry {
  bat: Bat
  /** Direction (deg about Y) the bat flees along; set at take-off, not saved. */
  fleeYaw: number
}

interface BatStore {
  seededNight: number | null
  entries: BatEntry[]
  simTime: number
  lastChitter: number | null
  /** Restores a sanitised save block. */
  restore: (save: BatSave) => void
}

export const useBatStore = create<BatStore>((set) => ({
  seededNight: null,
  entries: [],
  simTime: 0,
  lastChitter: null,
  restore: (save) =>
    set({
      seededNight: save.seededNight,
      entries: save.bats.map((bat) => ({ bat, fleeYaw: 0 })),
      simTime: save.simTime,
      lastChitter: save.lastChitter,
    }),
}))

export function captureBatSave(): BatSave {
  const s = useBatStore.getState()
  return {
    seededNight: s.seededNight,
    bats: s.entries.map((e) => e.bat),
    simTime: s.simTime,
    lastChitter: s.lastChitter,
  }
}
