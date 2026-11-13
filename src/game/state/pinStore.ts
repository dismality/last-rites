// Map pins: the player's waypoints (design bible §11). One store for the pin domain; the rules
// live in systems/mapPins.ts. Only `pins` is data, so the retry snapshots and the save pick it up
// as-is. Pure zustand, no React / three.js imports.

import { create } from 'zustand'
import {
  addPin,
  reachPins,
  removePin,
  restorePins,
  serializePins,
  type Pin,
  type PinSlot,
  type PinTarget,
} from '../systems/mapPins'
import { emitCombatSound } from './combatSounds'

interface PinStoreState {
  /** Oldest first. */
  pins: Pin[]
  place: (target: PinTarget) => void
  remove: (slot: PinSlot) => void
  clear: () => void
  /** Replace from untrusted saved data. */
  restore: (raw: unknown) => void
  /** Clears pins the player has walked up to, with the sound and caption. Returns how many. */
  tickReach: (player: { x: number; z: number }) => number
}

export const usePinStore = create<PinStoreState>((set, get) => ({
  pins: [],
  place: (target) => set({ pins: addPin(get().pins, target) }),
  remove: (slot) => set({ pins: removePin(get().pins, slot) }),
  clear: () => {
    if (get().pins.length > 0) set({ pins: [] })
  },
  restore: (raw) => set({ pins: restorePins(raw) }),
  tickReach: (player) => {
    const cur = get().pins
    if (cur.length === 0) return 0
    const res = reachPins(cur, player)
    if (res.reached.length === 0) return 0
    set({ pins: res.pins })
    emitCombatSound('pin-reached')
    return res.reached.length
  },
}))

/** The pins as plain JSON, for the save file. */
export const capturePins = (): Pin[] => serializePins(usePinStore.getState().pins)
