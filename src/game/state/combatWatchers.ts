// Subscriptions that cancel in-progress actions when the player is hit (Req 16.3, 12.x).
import { subscribeToType } from '../events'
import { useCombatStore } from './combatStore'
import { useDoorStore } from './doorStore'

/** Returns the unsubscribe function. */
export function installCombatWatchers(): () => void {
  return subscribeToType('playerDamaged', () => {
    if (useDoorStore.getState().nail) useDoorStore.getState().setNail(null)
    if (useCombatStore.getState().live.use) useCombatStore.getState().patchLive({ use: null })
  })
}
