// Reads the stores and answers "what is the final rite doing right now?".
// One place, so the scene, the chapel altar and the HUD cannot disagree.

import { countRelics, riteAvailability, type RiteAvailability } from '../systems/finalRite'
import { RITE_DURATION } from '../systems/mystery'
import { STAGE_COUNT } from '../../data/stages'
import { useEndingStore } from './endingStore'
import { isStoryRun } from './guidanceStore'
import { useInventoryStore } from './inventoryStore'
import { useMysteryStore } from './mysteryStore'
import { useWorldStore } from './worldStore'

/** The night the rite is held on: the last stage in a story run, never in Endless. */
export function riteFinalNight(): number {
  return isStoryRun() ? STAGE_COUNT : Infinity
}

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
    finalNight: riteFinalNight(),
  })
  return { availability, relicCount, progress: Math.min(mystery.riteProgress, RITE_DURATION) }
}
