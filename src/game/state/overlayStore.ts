// Flags for the 08 overlays. They do not own Esc; they only count as open menus.

import { create } from 'zustand'
import type { BellPostId, CastId, MinigameId } from '../../data/cases'

interface OverlayState {
  merchantOpen: boolean
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
  /** Which plaster cast the 2c overlay opens on: the cast the player used in the world. */
  castFocus: CastId | null
  setCastFocus: (id: CastId | null) => void
  setMerchantOpen: (open: boolean) => void
  setAchievementsOpen: (open: boolean) => void
  setModeSelectOpen: (open: boolean) => void
}

export const useOverlayStore = create<OverlayState>((set) => ({
  merchantOpen: false,
  achievementsOpen: false,
  modeSelectOpen: false,
  altarPanelOpen: false,
  setAltarPanelOpen: (altarPanelOpen) => set({ altarPanelOpen }),
  minigameOpen: null,
  setMinigameOpen: (minigameOpen) => set({ minigameOpen }),
  bellPostFocus: null,
  setBellPostFocus: (bellPostFocus) => set({ bellPostFocus }),
  castFocus: null,
  setCastFocus: (castFocus) => set({ castFocus }),
  setMerchantOpen: (merchantOpen) => set({ merchantOpen }),
  setAchievementsOpen: (achievementsOpen) => set({ achievementsOpen }),
  setModeSelectOpen: (modeSelectOpen) => set({ modeSelectOpen }),
}))
