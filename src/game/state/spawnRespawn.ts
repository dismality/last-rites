// Refills material spawn points at the start of every new day.
// The rules live in systems/spawns.ts; this only wires them to the phase event.

import { createRng, deriveSeed } from '../rng'
import { subscribeToType } from '../events'
import { respawnForDay } from '../systems/spawns'
import { useProgressionStore } from './progressionStore'
import { useSpawnStore } from './spawnStore'
import { useWorldStore } from './worldStore'

/**
 * Day 1 is filled when spawnStore is created. Every later day (phaseChanged to 'day') refills
 * from a stream keyed by run seed and night, so Retry Night, which rewinds to dusk and replays
 * the same dawn, re-rolls the identical stock instead of drawing a new one. Retry restores the
 * pre-respawn world from the dusk snapshot, so nothing is duplicated either.
 */
export function installSpawnRespawn(): () => void {
  return subscribeToType('phaseChanged', (e) => {
    if (e.phase !== 'day') return
    const night = useWorldStore.getState().nightNumber
    const rng = createRng(deriveSeed(useProgressionStore.getState().seed, 'respawn', night))
    const spawn = useSpawnStore.getState()
    spawn.setWorld(respawnForDay(spawn.world, rng))
  })
}
