// Open/closed state of the Dev_Panel. `enabled` starts false and only installDev turns it on,
// after isDevEnabled passes, so without the flag toggle() can never open anything.

import { create } from 'zustand'

interface DevPanelState {
  enabled: boolean
  open: boolean
  enable: () => void
  toggle: () => void
  close: () => void
}

export const useDevPanelStore = create<DevPanelState>((set, get) => ({
  enabled: false,
  open: false,
  enable: () => set({ enabled: true }),
  toggle: () => {
    if (!get().enabled) return
    set({ open: !get().open })
  },
  close: () => set({ open: false }),
}))
