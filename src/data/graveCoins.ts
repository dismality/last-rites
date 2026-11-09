// Grave Coin drops and piles — mirrored from docs/game-design.md §12.
// Pure data: no logic, no side effects.

import type { WaveEnemyId } from './enemies'

/** Coins per kill by type; `chance` is the probability that any drop happens. */
export const COIN_DROPS: Readonly<Record<WaveEnemyId, { amount: number; chance: number }>> = {
  shambler: { amount: 1, chance: 0.5 },
  wailer: { amount: 2, chance: 1 },
  lurker: { amount: 2, chance: 1 },
  bloater: { amount: 2, chance: 1 },
  brute: { amount: 5, chance: 1 },
}

/** Paid on top of the type's drop, even when a Shambler's roll fails. */
export const ELITE_COIN_BONUS = 5

export const COIN_PILE = {
  collectRadiusM: 1.5,
  fadeAfterS: 60,
  // Chosen here (design.md): the bible gives no merge, cap or shrink values.
  shrinkLastS: 2,
  mergeRadiusM: 1,
  maxPiles: 32,
} as const
