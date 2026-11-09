// Chapel state store — tracks repair progress, altar heal and rite state.
// Pure zustand, no React / three.js imports.

import { create } from 'zustand'
import { repair, isBarricadeBuilt, isAltarActive, isBellActive } from '../systems/repairs'
import type { ChapelState, RepairResult } from '../systems/repairs'
import { useDoorStore } from './doorStore'
import { useInventoryStore } from './inventoryStore'

export type { ChapelState }

export interface ChapelStoreState {
  chapel: ChapelState

  /**
   * Attempt the next repair stage.
   * Reads current inventory from inventoryStore, calls repair(), and writes
   * both inventory and chapel state back on success.
   */
  applyRepair: () => RepairResult

  /** Mark whether the altar heal has been used today (called by the altar interact). */
  setAltarHealedToday: (v: boolean) => void

  /** Toggle final-rite mode — disables the door block during night 5 ending. */
  setFinalRiteActive: (v: boolean) => void

  /** Called at dawn: resets per-day state (altarHealedToday → false). */
  resetDailyState: () => void

  // ── Convenience selectors (re-export from the pure system) ──────────────

  /** True when stage 1 complete and final rite is not active. */
  isBarricadeBuilt: () => boolean

  /** True when stage 2 is complete. */
  isAltarActive: () => boolean

  /** True when stage 3 is complete. */
  isBellActive: () => boolean
}

const INITIAL_CHAPEL: ChapelState = {
  completedStages: [],
  altarHealedToday: false,
  finalRiteActive: false,
}

export const useChapelStore = create<ChapelStoreState>((set, get) => ({
  chapel: INITIAL_CHAPEL,

  applyRepair: () => {
    const { inventory, setInventory } = useInventoryStore.getState()
    const before = get().chapel
    const result = repair(inventory, before)
    if (result.ok) {
      setInventory(result.inv)
      set({ chapel: result.chapel })
      // Stage 1 fits the barricade frames and the starting boards (Req 16.1).
      if (!isBarricadeBuilt(before) && isBarricadeBuilt(result.chapel))
        useDoorStore.getState().build()
    }
    return result
  },

  setAltarHealedToday: (v) =>
    set((state) => ({
      chapel: { ...state.chapel, altarHealedToday: v },
    })),

  setFinalRiteActive: (v) =>
    set((state) => ({
      chapel: { ...state.chapel, finalRiteActive: v },
    })),

  resetDailyState: () =>
    set((state) => ({
      chapel: { ...state.chapel, altarHealedToday: false },
    })),

  isBarricadeBuilt: () => isBarricadeBuilt(get().chapel),

  isAltarActive: () => isAltarActive(get().chapel),

  isBellActive: () => isBellActive(get().chapel),
}))
