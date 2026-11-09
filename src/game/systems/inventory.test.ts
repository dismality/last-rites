import { describe, expect, it } from 'vitest'
import * as fc from 'fast-check'
import { addItem, assignHotbar, countItem, createInventory, hasItems, removeItem } from './inventory'
import { ITEMS, ITEM_MAP, SATCHEL_SLOTS } from '../../data/items'
import type { Inventory, ItemId } from '../types'

const allIds = ITEMS.map((i) => i.id)
const arbItem = fc.constantFrom(...allIds)
const arbOp = fc.record({ id: arbItem, qty: fc.integer({ min: 0, max: 25 }) })
const arbOps = fc.array(arbOp, { maxLength: 40 })

function build(ops: { id: ItemId; qty: number }[]): Inventory {
  return ops.reduce((inv, op) => addItem(inv, op.id, op.qty).inv, createInventory())
}

describe('addItem examples', () => {
  it('reports a full material stack with the item name', () => {
    const full = addItem(createInventory(), 'bone', 10).inv
    const r = addItem(full, 'bone', 1)
    expect(r.added).toBe(0)
    expect(r.rejected).toBe(1)
    expect(r.reason).toBe('stack-full')
    expect(r.message).toBe('Satchel full: Bone')
  })

  it('reports a full satchel when all 12 slots are used', () => {
    let inv = createInventory()
    for (let i = 0; i < SATCHEL_SLOTS; i++) inv = addItem(inv, 'bandage', 1).inv
    const r = addItem(inv, 'bone', 3)
    expect(r.reason).toBe('satchel-full')
    expect(r.message).toBe('Satchel full')
    expect(r.rejected).toBe(3)
  })

  it('a larger slot limit holds more stacks, and the default still holds 12', () => {
    let inv = createInventory()
    for (let i = 0; i < SATCHEL_SLOTS; i++) inv = addItem(inv, 'bandage', 1).inv
    expect(addItem(inv, 'bone', 1).reason).toBe('satchel-full')
    const r = addItem(inv, 'bone', 1, SATCHEL_SLOTS + 2)
    expect(r.reason).toBeNull()
    expect(r.inv.slots).toHaveLength(SATCHEL_SLOTS + 1)
  })

  it('puts keys, relics and pages outside the slots, even when full', () => {
    let inv = createInventory()
    for (let i = 0; i < SATCHEL_SLOTS; i++) inv = addItem(inv, 'bandage', 1).inv
    inv = addItem(inv, 'rusted-crypt-key', 1).inv
    inv = addItem(inv, 'crane-rosary', 1).inv
    inv = addItem(inv, 'journal-page-1', 1).inv
    expect(inv.slots).toHaveLength(SATCHEL_SLOTS)
    expect(inv.keyItems).toEqual(['rusted-crypt-key', 'journal-page-1'])
    expect(inv.relics).toEqual(['crane-rosary'])
    expect(addItem(inv, 'crane-rosary', 1).reason).toBe('duplicate')
  })

  it('does not mutate its input', () => {
    const inv = build([{ id: 'bone', qty: 4 }])
    const snapshot = structuredClone(inv)
    addItem(inv, 'bone', 3)
    removeItem(inv, 'bone', 2)
    expect(inv).toEqual(snapshot)
  })
})

describe('removeItem / hasItems / assignHotbar examples', () => {
  it('clears a hotbar binding when the last copy is removed', () => {
    let inv = addItem(createInventory(), 'bandage', 1).inv
    inv = assignHotbar(inv, 1, 'bandage')
    expect(inv.hotbar[1]).toBe('bandage')
    expect(removeItem(inv, 'bandage', 1).inv.hotbar[1]).toBeNull()
  })

  it('moves a binding instead of duplicating it and rejects items not held', () => {
    let inv = addItem(createInventory(), 'bandage', 1).inv
    inv = assignHotbar(assignHotbar(inv, 0, 'bandage'), 2, 'bandage')
    expect(inv.hotbar).toEqual([null, null, 'bandage', null])
    expect(assignHotbar(inv, 0, 'bone')).toBe(inv)
    expect(assignHotbar(inv, 4, 'bandage')).toBe(inv)
  })

  it('sums duplicate requirements', () => {
    const inv = build([{ id: 'bone', qty: 3 }])
    expect(hasItems(inv, [{ item: 'bone', qty: 2 }, { item: 'bone', qty: 2 }])).toBe(false)
    expect(hasItems(inv, [{ item: 'bone', qty: 3 }])).toBe(true)
  })
})

describe('property: inventory invariants', () => {
  it('never exceeds slot or stack limits', () => {
    // Validates: Requirements 2.1, 2.2, 2.3
    fc.assert(
      fc.property(arbOps, (ops) => {
        const inv = build(ops)
        expect(inv.slots.length).toBeLessThanOrEqual(SATCHEL_SLOTS)
        for (const s of inv.slots) {
          expect(s.qty).toBeGreaterThan(0)
          expect(s.qty).toBeLessThanOrEqual(ITEM_MAP[s.item].stackLimit)
        }
        // Key items and relics never leak into slots.
        const slotIds = new Set<string>(inv.slots.map((s) => s.item))
        for (const k of [...inv.keyItems, ...inv.relics]) expect(slotIds.has(k)).toBe(false)
      }),
    )
  })

  it('conserves quantity: added + rejected == requested', () => {
    // Validates: Requirements 2.1, 2.2, 2.4
    fc.assert(
      fc.property(arbOps, arbOp, (ops, op) => {
        const r = addItem(build(ops), op.id, op.qty)
        expect(r.added + r.rejected).toBe(op.qty)
        expect(r.reason === null).toBe(r.rejected === 0)
        expect(countItem(r.inv, op.id) - countItem(build(ops), op.id)).toBe(r.added)
      }),
    )
  })

  it('remove undoes add: removing what was added restores item counts', () => {
    // Validates: Requirements 2.1, 4.4, 5.4
    fc.assert(
      fc.property(arbOps, arbOp, (ops, op) => {
        const before = build(ops)
        const added = addItem(before, op.id, op.qty)
        const after = removeItem(added.inv, op.id, added.added)
        expect(after.removed).toBe(added.added)
        for (const id of allIds) expect(countItem(after.inv, id)).toBe(countItem(before, id))
      }),
    )
  })

  it('removeItem never removes more than held and hasItems agrees', () => {
    // Validates: Requirements 5.4
    fc.assert(
      fc.property(arbOps, arbOp, (ops, op) => {
        const inv = build(ops)
        const held = countItem(inv, op.id)
        const r = removeItem(inv, op.id, op.qty)
        expect(r.removed).toBe(Math.min(held, op.qty))
        expect(hasItems(inv, [{ item: op.id, qty: op.qty }])).toBe(held >= op.qty)
      }),
    )
  })
})

