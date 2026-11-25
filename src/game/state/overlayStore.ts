// Flags for the 08 overlays. They do not own Esc; they only count as open menus.

import { create } from 'zustand'
import type { BellPostId, MinigameId } from '../../data/cases'

interface OverlayState {
  merchantOpen: boolean
  /** The hut's vending panel (spec 11 H6). Holds the cursor; never pauses, never owns Esc. */
  vendingOpen: boolean
  setVendingOpen: (open: boolean) => void
  achievementsOpen: boolean
  modeSelectOpen: boolean
  /** The altar answer panel (spec 10). It owns Esc itself and never freezes the night. */
  altarPanelOpen: boolean
  setAltarPanelOpen: (open: boolean) => void
  /** The Minigame overlay that is open, if any (spec 10 task 3.2). Counts as an open menu. */
  minigameOpen: MinigameId | null
  setMinigameOpen: (id: MinigameId | null) => void
  /** Which bell post the 1b overlay opens on: the post the player used in the world. */
  bellPostFocus: BellPostId | null
  setBellPostFocus: (id: BellPostId | null) => void
  setMerchantOpen: (open: boolean) => void
  setAchievementsOpen: (open: boolean) => void
  setModeSelectOpen: (open: boolean) => void
}

export const useOverlayStore = create<OverlayState>((set) => ({
  merchantOpen: false,
  vendingOpen: false,
  setVendingOpen: (vendingOpen) => set({ vendingOpen }),
  achievementsOpen: false,
  modeSelectOpen: false,
  altarPanelOpen: false,
  setAltarPanelOpen: (altarPanelOpen) => set({ altarPanelOpen }),
  minigameOpen: null,
  setMinigameOpen: (minigameOpen) => set({ minigameOpen }),
  bellPostFocus: null,
  setBellPostFocus: (bellPostFocus) => set({ bellPostFocus }),
  setMerchantOpen: (merchantOpen) => set({ merchantOpen }),
  setAchievementsOpen: (achievementsOpen) => set({ achievementsOpen }),
  setModeSelectOpen: (modeSelectOpen) => set({ modeSelectOpen }),
}))
