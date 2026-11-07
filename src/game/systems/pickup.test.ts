import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { pickupMaterial } from './pickup'
import { createInventory, addItem, countItem } from './inventory'
import { createSpawnWorld } from './spawns'
import type { Inventory, ItemId } from '../types'

const worldWith = (item: 'bone' | 'cloth', qty: number) => ({
  ...createSpawnWorld(),
  materials: { s1: [{ item, qty }] },
})

describe('pickupMaterial', () => {
  it('adds the stack and toasts "+2 Bone" (2.1)', () => {
    const r = pickupMaterial(createInventory(), worldWith('bone', 2), 's1', 0)!
    expect(r.toast).toBe('+2 Bone')
    expect(countItem(r.inv, 'bone')).toBe(2)
    expect(r.world.materials.s1).toEqual([])
  })

  it('refuses a full stack with "Satchel full: Bone" and keeps the item (2.2, 2.4)', () => {
    const inv = addItem(createInventory(), 'bone', 10).inv
    const world = worldWith('bone', 2)
    const r = pickupMaterial(inv, world, 's1', 0)!
    expect(r.toast).toBe('Satchel full: Bone')
    expect(r.inv).toBe(inv)
    expect(r.world).toBe(world)
  })

  it('refuses a new material when all 12 slots are used (2.3, 2.4)', () => {
    const filled: Inventory = {
      ...createInventory(),
      slots: Array.from({ length: 12 }, () => ({ item: 'rusty-shovel' as ItemId, qty: 1 })),
    }
    const world = worldWith('cloth', 1)
    const r = pickupMaterial(filled, world, 's1', 0)!
    expect(r.toast).toBe('Satchel full')
    expect(r.world).toBe(world)
  })

  it('takes what fits and leaves the remainder', () => {
    const inv = addItem(createInventory(), 'bone', 9).inv
    const r = pickupMaterial(inv, worldWith('bone', 3), 's1', 0)!
    expect(r.toast).toBe('+1 Bone')
    expect(r.world.materials.s1).toEqual([{ item: 'bone', qty: 2 }])
  })

  it('returns null for an unknown stack', () => {
    expect(pickupMaterial(createInventory(), createSpawnWorld(), 'nope', 0)).toBeNull()
  })

  it('conserves quantity between satchel and world', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10 }), fc.integer({ min: 1, max: 5 }), (have, qty) => {
        const inv = addItem(createInventory(), 'bone', have).inv
        const r = pickupMaterial(inv, worldWith('bone', qty), 's1', 0)!
        const left = r.world.materials.s1.reduce((n, s) => n + s.qty, 0)
        expect(countItem(r.inv, 'bone') + left).toBe(have + qty)
        expect(countItem(r.inv, 'bone')).toBeLessThanOrEqual(10)
      }),
    )
  })
})
