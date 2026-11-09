import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SATCHEL_SLOTS } from '../../data/items'
import { clearSubscribers, subscribe } from '../events'
import { createInventory } from '../systems/inventory'
import type { GameEvent } from '../types'
import { useInventoryStore } from './inventoryStore'
import { useSpawnStore } from './spawnStore'

describe('spawnStore.collectMaterial events', () => {
  let seen: GameEvent[]

  beforeEach(() => {
    seen = []
    clearSubscribers()
    subscribe((e) => seen.push(e))
    useInventoryStore.getState().setInventory(createInventory())
    useSpawnStore.getState().setWorld({
      materials: { 'test-spot': [{ item: 'bone', qty: 2 }] },
      collectedFixed: [],
    })
  })

  afterEach(() => clearSubscribers())

  it('emits itemCollected on a successful pickup', () => {
    useSpawnStore.getState().collectMaterial('test-spot', 0)
    expect(seen).toEqual([{ type: 'itemCollected', itemId: 'bone' }])
  })

  it('emits nothing when the satchel is full', () => {
    const inv = createInventory()
    useInventoryStore.getState().setInventory({
      ...inv,
      slots: Array.from({ length: SATCHEL_SLOTS }, () => ({ item: 'cloth' as const, qty: 10 })),
    })
    useSpawnStore.getState().collectMaterial('test-spot', 0)
    expect(seen).toEqual([])
  })

  it('emits nothing for an unknown spawn', () => {
    useSpawnStore.getState().collectMaterial('nowhere', 0)
    expect(seen).toEqual([])
  })
})
