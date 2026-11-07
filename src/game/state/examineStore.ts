// Examine mode state. Opening freezes the simulation (gameStore.examining);
// closing files the item in the journal (keyItems/relics, never a satchel slot).
// Pure zustand, no React / three.js imports.
import { create } from 'zustand'
import { ITEM_MAP, usesSatchelSlot } from '../../data/items'
import { addItem } from '../systems/inventory'
import type { ItemId } from '../types'
import { useGameStore } from './gameStore'
import { useInventoryStore } from './inventoryStore'
import { useToastStore } from './toastStore'

interface ExamineState {
  /** Item being examined, or null when closed. */
  item: ItemId | null
  /** Clue text once the hidden mark has been revealed. */
  clueRevealed: boolean
  /** Open examine mode for a key item, relic or lore item. Other kinds are ignored. */
  open: (id: ItemId) => void
  setClueRevealed: () => void
  /** Close and store the item in the journal. */
  close: () => void
}

export const useExamineStore = create<ExamineState>((set, get) => ({
  item: null,
  clueRevealed: false,
  open: (id) => {
    if (get().item || usesSatchelSlot(ITEM_MAP[id].kind)) return
    set({ item: id, clueRevealed: false })
    useGameStore.getState().setExamining(true)
  },
  setClueRevealed: () => set({ clueRevealed: true }),
  close: () => {
    const id = get().item
    if (!id) return
    const res = addItem(useInventoryStore.getState().inventory, id, 1)
    useInventoryStore.getState().setInventory(res.inv)
    useToastStore.getState().push(`Added to journal: ${ITEM_MAP[id].name}`)
    set({ item: null, clueRevealed: false })
    useGameStore.getState().setExamining(false)
  },
}))
