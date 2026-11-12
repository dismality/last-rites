// Tombstone rubbing state. Opening freezes the simulation like examine mode
// (gameStore.examining), so the scare director stays quiet while the player reads.
// Pure zustand, no React / three.js imports.
import { create } from 'zustand'
import { TOMBSTONE_MAP, type TombstoneId } from '../../data/tombstones'
import { readTombstone } from '../systems/tombstones'
import { useGameStore } from './gameStore'
import { useInventoryStore } from './inventoryStore'
import { useMysteryStore } from './mysteryStore'

interface TombstoneState {
  id: TombstoneId | null
  /** Ledger cross-check result for the open stone. */
  wrongGrave: boolean
  /** Stones read this run. Drives the "nothing new here" cue; clue-bearing stones also check the journal. */
  readIds: TombstoneId[]
  open: (id: TombstoneId) => void
  close: () => void
}

export const useTombstoneStore = create<TombstoneState>((set, get) => ({
  id: null,
  wrongGrave: false,
  readIds: [],
  open: (id) => {
    if (get().id || useGameStore.getState().examining) return
    const reading = readTombstone(TOMBSTONE_MAP[id], useInventoryStore.getState().inventory)
    for (const clue of reading.clueIds) useMysteryStore.getState().discoverClue(clue)
    set((s) => ({
      id,
      wrongGrave: reading.wrongGrave,
      readIds: s.readIds.includes(id) ? s.readIds : [...s.readIds, id],
    }))
    useGameStore.getState().setExamining(true)
  },
  close: () => {
    if (!get().id) return
    set({ id: null, wrongGrave: false })
    useGameStore.getState().setExamining(false)
  },
}))
