// Dawn upgrades mirrored from docs/game-design.md §12 "Dawn upgrades". Pool order is the table order.
import type { DawnUpgradeId } from '../game/types'

export interface DawnUpgradeDef {
  id: DawnUpgradeId
  name: string
  maxRank: 1 | 2
  /** A shape cue on the card, so an upgrade is never told apart by colour alone. */
  rune: string
}

export const DAWN_UPGRADES: readonly DawnUpgradeDef[] = [
  { id: 'iron-constitution', name: 'Iron Constitution', maxRank: 2, rune: 'ᚦ' },
  { id: 'steady-hands', name: 'Steady Hands', maxRank: 2, rune: 'ᚺ' },
  { id: 'long-wick', name: 'Long Wick', maxRank: 2, rune: 'ᛚ' },
  { id: 'deep-pockets', name: 'Deep Pockets', maxRank: 1, rune: 'ᛈ' },
  { id: 'second-wind', name: 'Second Wind', maxRank: 2, rune: 'ᚹ' },
  { id: 'gravedigger', name: 'Gravedigger', maxRank: 1, rune: 'ᚷ' },
  { id: 'hardened-boards', name: 'Hardened Boards', maxRank: 1, rune: 'ᛒ' },
  { id: 'grim-harvest', name: 'Grim Harvest', maxRank: 2, rune: 'ᚲ' },
  { id: 'marksman', name: 'Marksman', maxRank: 1, rune: 'ᛗ' },
  { id: 'blessed-reach', name: 'Blessed Reach', maxRank: 1, rune: 'ᛟ' },
]

/** Effect of one rank. Fractions are 0.15 = 15%; maxHealth is HP, satchelSlots slots, flaskRadiusM metres. */
export const UPGRADE_PER_RANK = {
  maxHealth: 15,
  reload: 0.15,
  lanternDrain: 0.2,
  satchelSlots: 2,
  staminaRegen: 0.25,
  digTime: 0.3,
  boardHp: 0.25,
  coinDrop: 0.25,
  headshot: 0.25,
  flaskRadiusM: 1,
} as const

export const OFFER_SIZE = 3
