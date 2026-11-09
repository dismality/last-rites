// Flags for the 08 overlays. They do not own Esc; they only count as open menus.

import { create } from 'zustand'

interface OverlayState {
  merchantOpen: boolean
  achievementsOpen: boolean
  modeSelectOpen: boolean
  setMerchantOpen: (open: boolean) => void
  setAchievementsOpen: (open: boolean) => void
  setModeSelectOpen: (open: boolean) => void
}

export const useOverlayStore = create<OverlayState>((set) => ({
  merchantOpen: false,
  achievementsOpen: false,
  modeSelectOpen: false,
  setMerchantOpen: (merchantOpen) => set({ merchantOpen }),
  setAchievementsOpen: (achievementsOpen) => set({ achievementsOpen }),
  setModeSelectOpen: (modeSelectOpen) => set({ modeSelectOpen }),
}))
