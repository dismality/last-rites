// Stats derived from dawn upgrade ranks (spec 08, Req 1.7, 1.8, 1.11).
// Pure zustand glue, no React / three.js imports.
import { PLAYER_MAX_HEALTH } from '../../data/balance'
import { modifiersFromRanks, type Modifiers } from '../systems/dawnUpgrades'
import { usePlayerStore } from './playerStore'
import { useProgressionStore, type Ranks } from './progressionStore'

let cachedRanks: Ranks | null = null
let cachedModifiers: Modifiers | null = null

/** Memoised by the ranks object identity so per-frame callers get a stable reference. */
export function currentModifiers(): Modifiers {
  const ranks = useProgressionStore.getState().ranks
  if (cachedModifiers === null || cachedRanks !== ranks) {
    cachedRanks = ranks
    cachedModifiers = modifiersFromRanks(ranks)
  }
  return cachedModifiers
}

/** Writes max HP from the ranks; call after a pick, a new run and a load. */
export function syncDerivedStats(): void {
  usePlayerStore.getState().setMaxHealth(PLAYER_MAX_HEALTH + currentModifiers().maxHealthBonus)
}
