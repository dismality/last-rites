// Inventory state store — holds the player's satchel, key items, relics and hotbar.
// Pure zustand, no React / three.js imports.

import { create } from 'zustand'
import { hotbarItem } from '../systems/satchel'
import type { Inventory, ItemId, KeyItemId, RelicId } from '../types'

export interface InventoryState {
  inventory: Inventory

  /** Replace the full inventory (used after crafting or other atomic mutations). */
  setInventory: (inv: Inventory) => void

  /** Add a key item (no slot cost). */
  addKeyItem: (id: KeyItemId) => void

  /** Add a relic (no slot cost). */
  addRelic: (id: RelicId) => void

  /** Set a hotbar slot binding. */
  setHotbar: (slot: 0 | 1 | 2 | 3, item: ItemId | null) => void

  /** Hotbar slot whose item is in hand; the item itself is derived from `inventory.hotbar`. */
  equippedSlot: 0 | 1 | 2 | 3 | null

  /** Equip what a hotbar number key points at. Empty slots leave the current item in hand. */
  equipSlot: (slot: 0 | 1 | 2 | 3) => void
}

const EMPTY_INVENTORY: Inventory = {
  slots: [
    // Start with the rusty shovel already in the satchel and on hotbar slot 0.
    { item: 'rusty-shovel', qty: 1 },
  ],
  keyItems: [],
  relics: [],
  hotbar: ['rusty-shovel', null, null, null],
}

export const useInventoryStore = create<InventoryState>((set) => ({
  inventory: EMPTY_INVENTORY,
  equippedSlot: 0,

  equipSlot: (slot) =>
    set((state) => (hotbarItem(state.inventory, slot) ? { equippedSlot: slot } : state)),

  setInventory: (inv) => set({ inventory: inv }),

  addKeyItem: (id) =>
    set((state) => {
      if (state.inventory.keyItems.includes(id)) return state
      return {
        inventory: {
          ...state.inventory,
          keyItems: [...state.inventory.keyItems, id],
        },
      }
    }),

  addRelic: (id) =>
    set((state) => {
      if (state.inventory.relics.includes(id)) return state
      return {
        inventory: {
          ...state.inventory,
          relics: [...state.inventory.relics, id],
        },
      }
    }),

  setHotbar: (slot, item) =>
    set((state) => {
      const hotbar = [...state.inventory.hotbar] as Inventory['hotbar']
      hotbar[slot] = item
      return { inventory: { ...state.inventory, hotbar } }
    }),
}))
