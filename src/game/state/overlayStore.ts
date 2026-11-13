// Flags for the 08 overlays. They do not own Esc; they only count as open menus.

import { create } from 'zustand'

interface OverlayState {
  merchantOpen: boolean
  achievementsOpen: boolean
  modeSelectOpen: boolean
  /** The altar answer panel (spec 10). It owns Esc itself and never freezes the night. */
  altarPanelOpen: boolean
  setAltarPanelOpen: (open: boolean) => void
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
  setMerchantOpen: (merchantOpen) => set({ merchantOpen }),
  setAchievementsOpen: (achievementsOpen) => set({ achievementsOpen }),
  setModeSelectOpen: (modeSelectOpen) => set({ modeSelectOpen }),
}))
