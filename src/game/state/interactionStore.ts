// Currently hovered interactable (drives the HUD prompt and crosshair hand).
// Pure zustand, no React / three.js imports.

import { create } from 'zustand'
import type { InteractAction } from '../systems/interaction'

export interface HoverTarget {
  id: string
  action: InteractAction
  /** Prompt from the cue rule (systems/interactionCue.ts); null shows nothing. */
  prompt?: string | null
  /** Pressing Interact would start the action (the hand crosshair shows only then). */
  actionable?: boolean
}

/** The prompt of a target that was just used up; the HUD fades it out instead of cutting it. */
export interface FadingPrompt {
  action: InteractAction
  prompt: string
  /** Bumps on every new fade so a CSS animation restarts. */
  serial: number
}

interface InteractionStoreState {
  hover: HoverTarget | null
  fading: FadingPrompt | null
  setHover: (hover: HoverTarget | null) => void
  startFading: (prev: HoverTarget) => void
  clearFading: () => void
}

let serial = 0

export const useInteractionStore = create<InteractionStoreState>((set, get) => ({
  hover: null,
  fading: null,
  // Skip no-op writes: this is set every frame by the raycast.
  setHover: (hover) => {
    const cur = get().hover
    if (
      cur?.id === hover?.id &&
      cur?.action === hover?.action &&
      cur?.prompt === hover?.prompt &&
      cur?.actionable === hover?.actionable
    )
      return
    set({ hover })
  },
  startFading: (prev) => {
    if (!prev.prompt) return
    set({ fading: { action: prev.action, prompt: prev.prompt, serial: ++serial } })
  },
  clearFading: () => {
    if (get().fading) set({ fading: null })
  },
}))
