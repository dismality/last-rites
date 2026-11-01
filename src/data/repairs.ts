// Chapel repair stage definitions — mirrored from docs/game-design.md §2.
// Pure data: no logic, no side effects.

import type { ItemStack } from '../game/types'

export type RepairEffect = 'barDoor' | 'altarSave' | 'bellWarning'

export interface RepairStage {
  stage: 1 | 2 | 3
  label: string
  cost: ItemStack[]
  effect: RepairEffect
  description: string
}

export const REPAIR_STAGES: RepairStage[] = [
  {
    stage: 1,
    label: 'Bar the Door',
    cost: [
      { item: 'iron-nail', qty: 4 },
      { item: 'bone', qty: 2 },
    ],
    effect: 'barDoor',
    description: 'Zombies cannot enter the chapel. True safe zone.',
  },
  {
    stage: 2,
    label: 'Relight the Altar',
    cost: [
      { item: 'candle-wax', qty: 3 },
      { item: 'holy-water', qty: 1 },
    ],
    effect: 'altarSave',
    description: 'Saves the game at the altar and heals 25 HP per visit per day.',
  },
  {
    stage: 3,
    label: 'Rehang the Bell',
    cost: [
      { item: 'iron-nail', qty: 6 },
      { item: 'cloth', qty: 2 },
    ],
    effect: 'bellWarning',
    description: 'Bell rings 20 s before each wave and reveals spawn directions on the map.',
  },
]
