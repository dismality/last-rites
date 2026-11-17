// The hut's vending machine (spec 11 H6): today's stock and the last purchase, for the machine's
// handle animation. Rules are in systems/vending.ts; actions in vendingActions.ts.
import { create } from 'zustand'
import type { HandleIndex, VendingRowId } from '../../data/vending'
import { freshStock, type VendingState } from '../systems/vending'

export interface VendingPurchase {
  row: VendingRowId
  handle: HandleIndex
  /** Increases with every purchase, so the machine restarts its animation on a repeat buy. */
  seq: number
}

interface VendingStore {
  stock: VendingState
  lastPurchase: VendingPurchase | null
  setStock: (stock: VendingState) => void
}

export const useVendingStore = create<VendingStore>((set) => ({
  stock: freshStock(),
  lastPurchase: null,
  setStock: (stock) => set({ stock }),
}))
