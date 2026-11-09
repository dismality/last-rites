// Player state store — position, orientation, health, stamina and interact target.
// Pure zustand, no React / three.js imports.

import { create } from 'zustand'
import { PLAYER_MAX_HEALTH } from '../../data/balance'
import type { PlayerState, ItemId } from '../types'

interface PlayerStoreState extends PlayerState {
  /** Max HP; raised by dawn upgrades. Kept out of PlayerState so saves are unchanged. */
  maxHealth: number
  setPosition: (pos: [number, number, number]) => void
  setYaw: (yaw: number) => void
  setPitch: (pitch: number) => void
  setHealth: (health: number) => void
  setStamina: (stamina: number) => void
  setInteractTarget: (target: ItemId | null) => void
  applyPlayerState: (state: Partial<PlayerState>) => void
}

export const usePlayerStore = create<PlayerStoreState>((set) => ({
  position: [0, 0, 0],
  yaw: 0,
  pitch: 0,
  health: PLAYER_MAX_HEALTH,
  maxHealth: PLAYER_MAX_HEALTH,
  stamina: 100,
  interactTarget: null,
  setPosition: (position) => set({ position }),
  setYaw: (yaw) => set({ yaw }),
  setPitch: (pitch) => set({ pitch }),
  setHealth: (health) => set({ health }),
  setStamina: (stamina) => set({ stamina }),
  setInteractTarget: (interactTarget) => set({ interactTarget }),
  applyPlayerState: (s) => set(s),
}))
