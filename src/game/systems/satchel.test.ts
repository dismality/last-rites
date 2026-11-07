import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { addItem, countItem, createInventory } from './inventory'
import { DROP_DISTANCE, dropPosition, dropStack, hotbarItem, pickupDrop } from './satchel'

const ORIGIN: [number, number, number] = [0, 0, 0]

describe('dropPosition', () => {
  it('lands in front of the player (yaw 0 faces -Z)', () => {
    const p = dropPosition([1, 0, 1], 0)
    expect(p[0]).toBeCloseTo(1)
    expect(p[2]).toBeCloseTo(1 - DROP_DISTANCE)
  })
})

describe('dropStack', () => {
  it('moves the whole stack out of the satchel and clears its hotbar binding', () => {
    let inv = addItem(createInventory(), 'bone', 4).inv
    inv = { ...inv, hotbar: ['bone', null, null, null] }
    const { inv: next, drop } = dropStack(inv, 'bone', ORIGIN, 'd1')
    expect(drop).toMatchObject({ item: 'bone', qty: 4 })
    expect(countItem(next, 'bone')).toBe(0)
    expect(next.hotbar[0]).toBeNull()
  })

  it('refuses items that are not held', () => {
    const inv = createInventory()
    expect(dropStack(inv, 'bone', ORIGIN, 'd1')).toEqual({ inv, drop: null })
  })

  it('property: dropping then picking up restores the quantity', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 10 }), (qty) => {
        const inv = addItem(createInventory(), 'cloth', qty).inv
        const { inv: after, drop } = dropStack(inv, 'cloth', ORIGIN, 'd')
        const back = pickupDrop(after, drop!)
        expect(back.remaining).toBeNull()
        expect(countItem(back.inv, 'cloth')).toBe(qty)
      }),
    )
  })
})

describe('pickupDrop', () => {
  it('leaves the drop on the ground when the satchel is full', () => {
    const full = ['bone', 'cloth', 'iron-nail', 'candle-wax', 'holy-water', 'lamp-oil', 'grave-salt'] as const
    let inv = createInventory()
    for (const m of full) inv = addItem(inv, m, 1).inv
    for (const g of ['bone-club', 'bandage', 'tallow-candle', 'lantern-refill', 'lantern-trap'] as const)
      inv = addItem(inv, g, 1).inv
    const drop = { id: 'd', item: 'holy-water-flask' as const, qty: 1, position: ORIGIN }
    const res = pickupDrop(inv, drop)
    expect(res.added).toBe(0)
    expect(res.remaining).toBe(drop)
  })
})

describe('hotbarItem', () => {
  it('returns the bound item only while it is still held', () => {
    const inv = { ...addItem(createInventory(), 'bone-club', 1).inv, hotbar: ['bone-club', 'bandage', null, null] as never }
    expect(hotbarItem(inv, 0)).toBe('bone-club')
    expect(hotbarItem(inv, 1)).toBeNull()
    expect(hotbarItem(inv, 7)).toBeNull()
  })
})
