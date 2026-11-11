// Elite zombie rules and drops — mirrored from docs/game-design.md §7 (07).
// Pure data: no logic, no side effects.

import type { ItemId } from '../game/types'
import type { EnemyId } from './enemies'

export const ELITE = {
  /** Elites can appear from this night on. */
  fromNight: 2,
  maxPerWave: 1,
  /** Chance per eligible spawn on Normal; Easy and Hard come from the mode table (spec 08). */
  chance: { normal: 0.06 },
  hpMult: 2,
  speedMult: 1.15,
  damageMult: 1.25,
  scale: 1.05,
  eligible: ['shambler', 'bloater', 'brute'] as readonly EnemyId[],
} as const

export interface EliteDrop {
  item: ItemId
  qty: number
  weight: number
}

/** An elite always drops exactly one of these, picked by weight. Weights sum to 100. */
export const ELITE_DROPS: readonly EliteDrop[] = [
  { item: 'revolver-cartridge', qty: 6, weight: 30 },
  { item: 'shotgun-shell', qty: 2, weight: 25 },
  { item: 'silver-filings', qty: 1, weight: 20 },
  { item: 'kola-tonic', qty: 1, weight: 15 },
  { item: 'black-powder', qty: 2, weight: 10 },
]

/**
 * What an ammo row turns into while its gun is not owned (docs/game-design.md §7 Elites).
 * The weight stays; the two materials are the ingredients of that ammo's recipe.
 */
export const ELITE_AMMO_SUBSTITUTES: Readonly<
  Record<'revolver-cartridge' | 'shotgun-shell', { item: ItemId; qty: number }>
> = {
  'revolver-cartridge': { item: 'lead-shot', qty: 2 },
  'shotgun-shell': { item: 'black-powder', qty: 1 },
}
