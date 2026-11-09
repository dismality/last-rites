// Grave Coin piles lying in the world (Night_State). Banked coins live in progressionStore.
import { create } from 'zustand'
import type { CoinPile } from '../systems/coins'

interface CoinStoreState {
  piles: CoinPile[]
  nextId: number
  setPiles: (piles: CoinPile[], nextId?: number) => void
  clear: () => void
}

const initial = () => ({ piles: [] as CoinPile[], nextId: 1 })

export const useCoinStore = create<CoinStoreState>((set) => ({
  ...initial(),
  setPiles: (piles, nextId) => set((s) => ({ piles, nextId: nextId ?? s.nextId })),
  clear: () => set(initial()),
}))
