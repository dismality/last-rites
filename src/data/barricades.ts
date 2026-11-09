// Chapel door barricade rules — mirrored from docs/game-design.md §2 (07).
// Pure data: no logic, no side effects.

import type { DoorId, ItemStack } from '../game/types'

/**
 * Largest board health a save may hold: boardHp 60 plus Hardened Boards (+25%, spec 08).
 * Kept here so save sanitising accepts those boards before the upgrade exists.
 */
export const BOARD_HP_MAX_SAVE = 75

export const DOORS = {
  ids: ['front', 'vestry'] as readonly DoorId[],
  slots: 3,
  boardHp: 60,
  /** Boards fitted when repair stage 1 is built. */
  startBoards: 2,
  nailCost: [
    { item: 'wood-plank', qty: 1 },
    { item: 'iron-nail', qty: 2 },
  ] as readonly ItemStack[],
  nailTimeS: 2,
  /** Brutes break boards this many times faster. */
  bruteMult: 2,
  /** Board damage multiplier during the final rite. */
  riteMult: 2,
  /** Nailing is cancelled after the player moves more than this (m). */
  nailMoveEpsM: 0.05,
} as const
