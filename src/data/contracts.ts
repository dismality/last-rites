// Side contracts — mirrored from docs/game-design.md §12.
// Pure data: no logic, no side effects.

import type { ContractId, DamageSource } from '../game/types'

/** A contract is never dealt unless every requirement holds right now. */
export interface ContractReq {
  weapon?: 'revolver' | 'shotgun'
  barricade?: true
  minWailersNextNight?: number
}

export interface ContractDef {
  id: ContractId
  name: string
  goal: number
  reward: number
  text: string
  req?: ContractReq
}

export const CONTRACTS: readonly ContractDef[] = [
  { id: 'c-dig-3', name: 'Grave Work', goal: 3, reward: 15, text: 'Dig 3 graves' },
  { id: 'c-shotgun-5', name: 'Both Barrels', goal: 5, reward: 20, text: 'Kill 5 zombies with the shotgun', req: { weapon: 'shotgun' } },
  { id: 'c-revolver-head-3', name: 'Steady Aim', goal: 3, reward: 20, text: 'Make 3 headshot kills with the revolver', req: { weapon: 'revolver' } },
  { id: 'c-melee-10', name: 'Close Work', goal: 10, reward: 15, text: 'Kill 10 zombies with melee weapons' },
  { id: 'c-wailer-2', name: 'Silence the Wailers', goal: 2, reward: 20, text: 'Kill 2 Wailers', req: { minWailersNextNight: 2 } },
  { id: 'c-boards-3', name: 'Hammer and Nails', goal: 3, reward: 10, text: 'Nail 3 barricade boards', req: { barricade: true } },
  { id: 'c-gather-8', name: 'Scavenger', goal: 8, reward: 10, text: 'Pick up 8 materials' },
  { id: 'c-unhurt', name: 'Unscathed', goal: 1, reward: 30, text: 'Survive the night taking 50 damage or less' },
]

export const CONTRACTS_PER_DAWN = 2
export const UNHURT_MAX_DAMAGE = 50
/** Only melee and heavy-melee kills count; kicks, thrown items and traps do not. */
export const MELEE_SOURCES: readonly DamageSource[] = ['melee', 'heavy']
