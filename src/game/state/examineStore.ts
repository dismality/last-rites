// Examine mode state. Opening freezes the simulation (gameStore.examining);
// closing files the item in the journal (keyItems/relics, never a satchel slot).
// Pure zustand, no React / three.js imports.
import { create } from 'zustand'
import { ITEM_MAP, usesSatchelSlot } from '../../data/items'
import { addItem } from '../systems/inventory'
import { playPageTurn } from '../../audio/AudioManager'
import type { ItemId, PageNumber } from '../types'
import { useCraftingStore } from './craftingStore'
import { useGameStore } from './gameStore'
import { useInventoryStore } from './inventoryStore'
import { pushJournalAddedToast } from './journalToast'
import { useMysteryStore } from './mysteryStore'
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
    const pageMatch = /^journal-page-([1-5])$/.exec(id)
    // A page says where to find it again; keys and relics keep their name in the toast.
    if (pageMatch) pushJournalAddedToast()
    else useToastStore.getState().push(`Added to journal: ${ITEM_MAP[id].name}`)
    if (pageMatch) {
      const page = Number(pageMatch[1]) as PageNumber
      useMysteryStore.getState().collectPage(page)
      // Page 3 teaches the Salt Circle; the unlock keys off the page being read.
      useCraftingStore.getState().applyUnlockEvent({ type: 'journalRead', page })
      playPageTurn()
    }
    set({ item: null, clueRevealed: false })
    useGameStore.getState().setExamining(false)
  },
}))
