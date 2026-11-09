// UI-level world state store — tracks overlays, workbench, chapel, and player health.
// (Renamed from worldStore.ts to avoid collision with the day/night WorldState type.)
// Pure zustand, no React / three.js imports.

import { create } from 'zustand'
import { usePlayerStore } from './playerStore'

export interface UiWorldState {
  /** Whether the player is currently at the workbench (camera moved to bench view). */
  workbenchOpen: boolean

  /**
   * Timestamp (Date.now()) of the last time the player took damage.
   * 0 means no hit has been registered this session.
   * The workbench / GameLoop watches for changes to this value and cancels
   * any in-progress craft when it sees a new hit.
   */
  lastDamageAt: number

  /** Whether the chapel repair overlay is currently open (Req 6.1). */
  chapelRepairOpen: boolean

  /**
   * Player health (0–100).
   * Kept here for simplicity until a dedicated playerStore is needed.
   */
  playerHealth: number

  /** Open the workbench (releases pointer lock, lerps camera). */
  openWorkbench: () => void

  /** Close the workbench (returns first-person control). */
  closeWorkbench: () => void

  /**
   * Record that the player was just hit.
   * Updates `lastDamageAt` to Date.now() so watchers can react.
   * Called by the combat system whenever the player takes damage.
   */
  registerHit: () => void

  /** Open the chapel repair UI overlay. */
  openChapelRepair: () => void

  /** Close the chapel repair UI overlay. */
  closeChapelRepair: () => void

  /**
   * Heal the player by `amount` HP, clamped to the player's max HP.
   * Called by the altar interact and by bandage use.
   */
  healPlayer: (amount: number) => void
}

export const useUiWorldStore = create<UiWorldState>((set) => ({
  workbenchOpen: false,
  lastDamageAt: 0,
  chapelRepairOpen: false,
  playerHealth: 100,
  openWorkbench: () => set({ workbenchOpen: true }),
  closeWorkbench: () => set({ workbenchOpen: false }),
  registerHit: () => set({ lastDamageAt: Date.now() }),
  openChapelRepair: () => set({ chapelRepairOpen: true }),
  closeChapelRepair: () => set({ chapelRepairOpen: false }),
  healPlayer: (amount) => {
    // Both copies of health are written so the HUD and the combat system never disagree.
    const player = usePlayerStore.getState()
    const next = Math.min(player.maxHealth, Math.max(0, player.health + amount))
    player.setHealth(next)
    set({ playerHealth: next })
  },
}))
