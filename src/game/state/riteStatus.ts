// Reads the stores and answers "what is the final rite doing right now?".
// One place, so the scene, the chapel altar and the HUD cannot disagree.

import { countRelics, riteAvailability, type RiteAvailability } from '../systems/finalRite'
import { RITE_DURATION } from '../systems/mystery'
import { useEndingStore } from './endingStore'
import { useInventoryStore } from './inventoryStore'
import { useMysteryStore } from './mysteryStore'
import { useWorldStore } from './worldStore'

export interface RiteStatus {
  availability: RiteAvailability
  relicCount: number
  /** Seconds completed, 0..RITE_DURATION */
  progress: number
}

export function readRiteStatus(): RiteStatus {
  const world = useWorldStore.getState()
  const mystery = useMysteryStore.getState().mystery
  const relicCount = countRelics(useInventoryStore.getState().inventory.relics, mystery.relics)
  const availability = riteAvailability({
    nightNumber: world.nightNumber,
    phase: world.phase,
    wavesCleared: useEndingStore.getState().nightFiveCleared,
    relicCount,
  })
  return { availability, relicCount, progress: Math.min(mystery.riteProgress, RITE_DURATION) }
}
