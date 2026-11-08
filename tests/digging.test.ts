// Digging end to end through the store: shovel required, hold-E duration, loot only after the dig.
import { beforeEach, describe, expect, it } from 'vitest'
import { DIG_DURATION_S } from '../src/data/digging'
import { useDigStore, DIG_ID_PREFIX } from '../src/game/state/digStore'
import { useInteractionStore } from '../src/game/state/interactionStore'
import { useInventoryStore } from '../src/game/state/inventoryStore'
import { usePlayerStore } from '../src/game/state/playerStore'
import { useSpawnStore } from '../src/game/state/spawnStore'
import { useWorldStore } from '../src/game/state/worldStore'
import { respawnForDay, createSpawnWorld } from '../src/game/systems/spawns'
import { createRng } from '../src/game/rng'

const GRAVE = 'grave-north-row'
const STEP = 1 / 60

function hold(seconds: number, held = true) {
  for (let t = 0; t < seconds - 1e-9; t += STEP) useDigStore.getState().step(STEP, held)
}
const loot = () => useSpawnStore.getState().world.materials[GRAVE] ?? []

beforeEach(() => {
  useDigStore.getState().reset()
  useSpawnStore.setState({ world: respawnForDay(createSpawnWorld(), createRng(5)) })
  useWorldStore.setState({ phase: 'day', nightNumber: 1 })
  usePlayerStore.setState({ position: [14, 0, -18] })
  useInventoryStore.setState({ equippedSlot: 0 })
  useInteractionStore.setState({ hover: { id: `${DIG_ID_PREFIX}${GRAVE}`, action: 'dig' } })
})

describe('grave digging', () => {
  it('shows no loot on an undug grave', () => {
    expect(loot()).toEqual([])
  })

  it('needs a shovel in hand', () => {
    useInventoryStore.setState({ equippedSlot: null })
    hold(DIG_DURATION_S + 1)
    expect(loot()).toEqual([])
    expect(useDigStore.getState().active).toBe(false)
    expect(useDigStore.getState().blockedReason(GRAVE)).toMatch(/shovel/i)
  })

  it('reveals loot only after holding for the full duration', () => {
    hold(DIG_DURATION_S - 0.5)
    expect(useDigStore.getState().active).toBe(true)
    expect(useDigStore.getState().progress).toBeGreaterThan(0.5)
    expect(loot()).toEqual([])
    hold(0.6)
    expect(loot().length).toBeGreaterThan(0)
    expect(useDigStore.getState().active).toBe(false)
  })

  it('releasing E cancels with no loot, and the grave can be dug again', () => {
    hold(1.5)
    hold(0.1, false)
    expect(loot()).toEqual([])
    expect(useDigStore.getState().active).toBe(false)
    hold(DIG_DURATION_S + 0.1)
    expect(loot().length).toBeGreaterThan(0)
  })

  it('a grave can only be dug once per day', () => {
    hold(DIG_DURATION_S + 0.1)
    const first = loot().length
    hold(DIG_DURATION_S + 0.1)
    expect(loot()).toHaveLength(first)
    expect(useDigStore.getState().blockedReason(GRAVE)).toMatch(/already/i)
    useWorldStore.setState({ nightNumber: 2 })
    expect(useDigStore.getState().blockedReason(GRAVE)).toBeNull()
  })
})
