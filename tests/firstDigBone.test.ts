// Spec 09, F1, end to end through the dig store: the first grave dug on day 1 always yields at
// least 3 bone (a Bone Club's worth), and only that one dig is topped up.
import { beforeEach, describe, expect, it } from 'vitest'
import { DAY1_FIRST_DIG_MIN_BONE } from '../src/data/balance'
import { DIG_DURATION_S } from '../src/data/digging'
import { useDigStore, DIG_ID_PREFIX } from '../src/game/state/digStore'
import { useInteractionStore } from '../src/game/state/interactionStore'
import { useInventoryStore } from '../src/game/state/inventoryStore'
import { usePlayerStore } from '../src/game/state/playerStore'
import { useSpawnStore } from '../src/game/state/spawnStore'
import { useWorldStore } from '../src/game/state/worldStore'
import { respawnForDay, createSpawnWorld } from '../src/game/systems/spawns'
import { createRng } from '../src/game/rng'

const STEP = 1 / 60
const GRAVES = {
  'grave-north-row': [14, 0, -18],
  'grave-oak-hollow': [-15, 0, 10],
} as const
type Grave = keyof typeof GRAVES

function dig(grave: Grave): void {
  usePlayerStore.setState({ position: [...GRAVES[grave]] })
  useInteractionStore.setState({ hover: { id: `${DIG_ID_PREFIX}${grave}`, action: 'dig' } })
  for (let t = 0; t < DIG_DURATION_S + 0.1; t += STEP) useDigStore.getState().step(STEP, true)
}
const loot = (grave: Grave) => useSpawnStore.getState().world.materials[grave] ?? []
const bone = (grave: Grave) =>
  loot(grave).filter((s) => s.item === 'bone').reduce((n, s) => n + s.qty, 0)

function freshRun(night: number): void {
  useDigStore.getState().reset()
  useSpawnStore.setState({ world: respawnForDay(createSpawnWorld(), createRng(5)) })
  useWorldStore.setState({ phase: 'day', nightNumber: night })
  useInventoryStore.setState({ equippedSlot: 0 })
}

beforeEach(() => freshRun(1))

describe('first dig on day 1', () => {
  it('always yields at least 3 bone, over many random dig rolls', () => {
    // The dig rng is reseeded from Math.random on every reset, so each pass is a new roll.
    for (let i = 0; i < 60; i++) {
      freshRun(1)
      dig('grave-north-row')
      expect(loot('grave-north-row').length).toBeGreaterThan(0)
      expect(bone('grave-north-row')).toBeGreaterThanOrEqual(DAY1_FIRST_DIG_MIN_BONE)
    }
  })

  it('tops up only the first dig: a second grave gets a plain roll', () => {
    dig('grave-north-row')
    dig('grave-oak-hollow')
    // grave-dig rolls 2 stacks; the guarantee would have added a third bone stack at most.
    expect(loot('grave-oak-hollow')).toHaveLength(2)
  })

  it('does not apply on later days', () => {
    freshRun(2)
    dig('grave-north-row')
    expect(loot('grave-north-row')).toHaveLength(2)
  })
})
