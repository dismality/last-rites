// Reads the stores and answers "can the rite be worked on right now?".
// One place, so the scene, the chapel altar and the HUD cannot disagree.

import { countRelics, riteAvailability, type RiteAvailability } from '../systems/finalRite'
import { STAGE_COUNT } from '../../data/stages'
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
  /** Relics held (the objective shows R/5). */
  relicCount: number
}

export function readRiteStatus(): RiteStatus {
  const world = useWorldStore.getState()
  const mystery = useMysteryStore.getState().mystery
  const relicCount = countRelics(useInventoryStore.getState().inventory.relics, mystery.relics)
  const availability = riteAvailability({
    nightNumber: world.nightNumber,
    phase: world.phase,
    finalNight: riteFinalNight(),
  })
  return { availability, relicCount }
}
