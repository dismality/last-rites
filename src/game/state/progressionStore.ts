// Progression domain: mode, run seed, dawn upgrades, score, Grave Coins, contracts, merchant
// stock, run stats and the storm flag. Everything here is saved and snapshotted for Retry
// Night (see progressionPersistence.ts). Pure zustand, no React / three.js imports.
import { create } from 'zustand'
import type { DawnUpgradeId, ModeId } from '../types'
import type { DealtContract } from '../systems/contracts'
import type { Stock } from '../systems/merchant'
import { DEFAULT_SEED, type NightSummary } from '../systems/progressionSave'
import { createRunStats, type RunStats } from '../systems/runStats'
import { setDawnPickProbe } from './menuState'
import { registerStatsPort } from './statsPort'

export type Ranks = Partial<Record<DawnUpgradeId, number>>

export interface ProgressionFields {
  mode: ModeId
  seed: number
  ranks: Ranks
  pendingPick: DawnUpgradeId[] | null
  dawnSummary: NightSummary | null
  score: number
  bossScored: boolean
  coins: number
  contracts: DealtContract[]
  stock: Stock | null
  stats: RunStats
  storm: { active: boolean }
}

interface ProgressionState extends ProgressionFields {
  patch: (p: Partial<ProgressionFields>) => void
  /** Adds (or subtracts) coins; the balance is floored at 0 and whole. */
  addCoins: (delta: number) => void
  setCoins: (coins: number) => void
  setContractList: (contracts: DealtContract[]) => void
  reset: () => void
}

export const initialProgression = (): ProgressionFields => ({
  mode: 'normal',
  seed: DEFAULT_SEED,
  ranks: {},
  pendingPick: null,
  dawnSummary: null,
  score: 0,
  bossScored: false,
  coins: 0,
  contracts: [],
  stock: null,
  stats: createRunStats(),
  storm: { active: false },
})

const clampCoins = (n: number): number => (Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0)

export const useProgressionStore = create<ProgressionState>((set) => ({
  ...initialProgression(),
  patch: (p) => set(p),
  addCoins: (delta) => set((s) => ({ coins: clampCoins(s.coins + (Number.isFinite(delta) ? delta : 0)) })),
  setCoins: (coins) => set({ coins: clampCoins(coins) }),
  setContractList: (contracts) => set({ contracts }),
  reset: () => set(initialProgression()),
}))

// menuState cannot import this store (it would be circular), so the store registers itself.
setDawnPickProbe(() => useProgressionStore.getState().pendingPick !== null)

registerStatsPort({
  get: () => useProgressionStore.getState().stats,
  set: (stats) => useProgressionStore.getState().patch({ stats }),
})
