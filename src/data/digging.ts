// Grave digging constants (design bible §4 shovel, §9 hand-from-grave; spec 02 Req 3).

import type { LootTableId } from './lootTables'

/** Seconds the player must hold Interact on a grave to finish digging. */
export const DIG_DURATION_S = 3

/** Chance that a finished dig triggers the hand-from-grave scare. */
export const DIG_HAND_SCARE_CHANCE_DAY = 0.2
export const DIG_HAND_SCARE_CHANCE_NIGHT = 0.4

/** Scare id handed to the scare director (spec 05). */
export const DIG_SCARE_ID = 'hand-from-grave'

/**
 * Horizontal drift (m) allowed while digging before it counts as moving.
 * Non-zero so physics jitter and the idle camera sway do not cancel a dig.
 */
export const DIG_MOVE_TOLERANCE_M = 0.15

/** Loot table used when a grave does not name its own. */
export const DEFAULT_GRAVE_LOOT_TABLE: LootTableId = 'grave-dig'
