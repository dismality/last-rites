// Currently hovered interactable (drives the HUD prompt and crosshair hand).
// Pure zustand, no React / three.js imports.

import { create } from 'zustand'
import type { InteractAction } from '../systems/interaction'

export interface HoverTarget {
  id: string
  action: InteractAction
}

interface InteractionStoreState {
  hover: HoverTarget | null
  setHover: (hover: HoverTarget | null) => void
}

export const useInteractionStore = create<InteractionStoreState>((set, get) => ({
  hover: null,
  // Skip no-op writes: this is set every frame by the raycast.
  setHover: (hover) => {
    const cur = get().hover
    if (cur?.id === hover?.id && cur?.action === hover?.action) return
    set({ hover })
  },
}))
