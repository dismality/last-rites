// The single list of persisted combat fields. Save and the Retry Night snapshot are both
// built from it, so a field cannot be saved but forgotten by Retry (Req 20.3).

import type { CombatSave } from '../systems/combatSave'
import { useCombatStore } from './combatStore'

export const COMBAT_PERSISTED = {
  combat: ['firearms', 'durability', 'upgrades', 'takenPickups'],
  doors: ['built', 'doors'],
} as const

export type DoorsSave = CombatSave['doors']

const NO_DOORS: DoorsSave = { built: false, front: [], vestry: [] }

/**
 * Builds the `combat` block of a save. The door block is passed in because the door store
 * is a separate domain; without it the doors are saved as not built.
 */
export function captureCombatSave(doors: DoorsSave = NO_DOORS): CombatSave {
  const s = useCombatStore.getState()
  const picked = Object.fromEntries(COMBAT_PERSISTED.combat.map((k) => [k, s[k]])) as Pick<
    CombatSave,
    (typeof COMBAT_PERSISTED.combat)[number]
  >
  return structuredClone({ ...picked, doors })
}
