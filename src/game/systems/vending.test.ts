// Tests for src/game/systems/vending.ts (spec 11 H6, Req 6.3 to 6.13, 6.15).
import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { VENDING_HANDLE_PULL_M, VENDING_PURCHASE_S, VENDING_ROWS, type VendingRowId } from '../../data/vending'
import { ITEMS, SATCHEL_SLOTS } from '../../data/items'
import type { Inventory, ItemId } from '../types'
import { addItem, countItem, createInventory } from './inventory'
import {
  buy,
  canBuy,
  freshStock,
  isForbidden,
  purchaseAnimation,
  resetAtDawn,
  sanitizeVending,
  visibleRows,
  withinVendingRange,
  type VendingState,
} from './vending'

const ROW_IDS = VENDING_ROWS.map((r) => r.id)
const arbRow = fc.constantFrom<VendingRowId>(...ROW_IDS)
const arbStock = fc
  .tuple(...VENDING_ROWS.map((r) => fc.integer({ min: 0, max: r.perDay })))
  .map((ns): VendingState => ({ stockLeft: Object.fromEntries(ROW_IDS.map((id, i) => [id, ns[i]])) as Record<VendingRowId, number> }))
/** Fillers that never stack with a vending item, so a full satchel really is full. */
const FILLERS: ItemId[] = [
  'bone',
  'iron-nail',
  'candle-wax',
  'cloth',
  'grave-salt',
  'wood-plank',
  'rusty-shovel',
  'bone-club',
  'nail-bomb',
  'salt-circle',
  'tallow-candle',
  'lantern-refill',
]
const arbInv = fc
  .record({ fill: fc.integer({ min: 0, max: SATCHEL_SLOTS }), own: fc.subarray([...ROW_IDS]) })
  .map(({ fill, own }) => {
    let inv: Inventory = createInventory()
    for (const id of own) inv = addItem(inv, id, 1).inv
    for (const f of FILLERS.slice(0, Math.max(0, fill - own.length))) inv = addItem(inv, f, 1).inv
    return inv
  })

const fullSatchel = (): Inventory => FILLERS.reduce((inv, f) => addItem(inv, f, 1).inv, createInventory())
const rowOf = (id: VendingRowId) => VENDING_ROWS.find((r) => r.id === id)!

describe('vending data rules', () => {
  // Feature: 11-horror-pass, Property 21: Vending stock never includes forbidden items
  it('stocks exactly the six rows of Req 6.3 and nothing forbidden', () => {
    expect(VENDING_ROWS.map((r) => [r.name, r.qty, r.price, r.perDay])).toEqual([
      ['Revolver Cartridges', 6, 12, 2],
      ['Shotgun Shells', 4, 14, 2],
      ['Lamp Oil', 1, 5, 3],
      ['Kola Tonic', 1, 18, 1],
      ['Brisk Draught', 1, 15, 1],
      ['Bandage', 1, 7, 2],
    ])
    fc.assert(
      fc.property(arbRow, arbStock, (id, v) => {
        expect(isForbidden(rowOf(id).item)).toBe(false)
        expect(Object.keys(v.stockLeft).every((k) => !isForbidden(k))).toBe(true)
      }),
      { numRuns: 100 },
    )
  })

  it('knows every forbidden kind', () => {
    for (const i of ITEMS) {
      if (i.kind === 'relic' || i.kind === 'key' || i.kind === 'lore') expect(isForbidden(i.id), i.id).toBe(true)
    }
    for (const id of ['holy-water', 'silver-filings', 'r-bandage', 'clue-hut-boots', 'journal-page-1']) {
      expect(isForbidden(id), id).toBe(true)
    }
  })

  it('gives every row a one-sentence blurb and a handle 0..4', () => {
    for (const r of VENDING_ROWS) {
      expect(r.blurb.trim().split(/[.!?](?:\s|$)/).filter((x) => x.trim()).length, r.id).toBe(1)
      expect([0, 1, 2, 3, 4]).toContain(r.handle)
    }
    expect(rowOf('bandage').handle).toBe(rowOf('lamp-oil').handle)
  })
})

describe('visibility and purchases', () => {
  // Feature: 11-horror-pass, Property 22: Vending visibility and purchase deltas
  it('shows a gun row iff the gun is owned', () => {
    fc.assert(
      fc.property(fc.boolean(), fc.boolean(), (revolver, shotgun) => {
        const ids = visibleRows({ revolver, shotgun }).map((r) => r.id)
        expect(ids.includes('revolver-cartridge')).toBe(revolver)
        expect(ids.includes('shotgun-shell')).toBe(shotgun)
        expect(ids.filter((i) => i !== 'revolver-cartridge' && i !== 'shotgun-shell')).toEqual([
          'lamp-oil',
          'kola-tonic',
          'brisk-draught',
          'bandage',
        ])
      }),
      { numRuns: 100 },
    )
  })

  // Feature: 11-horror-pass, Property 22: Vending visibility and purchase deltas
  it('a successful purchase moves exactly the price, one stock and the goods', () => {
    fc.assert(
      fc.property(arbRow, arbStock, fc.integer({ min: 0, max: 200 }), arbInv, (id, v, coins, inv) => {
        const out = buy(id, v, coins, inv, SATCHEL_SLOTS)
        if (!out.result.ok) return
        const row = out.result.row
        expect(out.coins).toBe(coins - row.price)
        expect(out.state.stockLeft[id]).toBe(v.stockLeft[id] - 1)
        for (const other of ROW_IDS) if (other !== id) expect(out.state.stockLeft[other]).toBe(v.stockLeft[other])
        expect(countItem(out.inv, row.item)).toBe(countItem(inv, row.item) + row.qty)
      }),
      { numRuns: 300 },
    )
  })

  it('buys a Brisk Draught into an empty satchel', () => {
    const out = buy('brisk-draught', freshStock(), 20, createInventory(), SATCHEL_SLOTS)
    expect(out.result.ok).toBe(true)
    expect(out.coins).toBe(5)
    expect(out.state.stockLeft['brisk-draught']).toBe(0)
    expect(countItem(out.inv, 'brisk-draught')).toBe(1)
  })
})

describe('refusals', () => {
  // Feature: 11-horror-pass, Property 23: Vending refusals leave state unchanged and coins never go negative
  it('never goes below 0 coins and refuses without touching anything', () => {
    fc.assert(
      fc.property(fc.array(arbRow, { maxLength: 25 }), arbStock, fc.integer({ min: 0, max: 120 }), arbInv, (ids, v0, c0, inv0) => {
        let v = v0
        let coins = c0
        let inv = inv0
        for (const id of ids) {
          const out = buy(id, v, coins, inv, SATCHEL_SLOTS)
          if (!out.result.ok) {
            expect(out.state).toBe(v)
            expect(out.coins).toBe(coins)
            expect(out.inv).toBe(inv)
            expect(out.result.text.length).toBeGreaterThan(0)
            if (out.result.reason === 'coins') {
              expect(out.result.shortfall).toBe(rowOf(id).price - coins)
              expect(out.result.text).toContain(`${out.result.shortfall} short`)
            }
          }
          v = out.state
          coins = out.coins
          inv = out.inv
          expect(coins).toBeGreaterThanOrEqual(0)
        }
      }),
      { numRuns: 300 },
    )
  })

  it('names each cause', () => {
    const empty = { stockLeft: { ...freshStock().stockLeft, bandage: 0 } }
    expect(canBuy('bandage', empty, 100, createInventory(), SATCHEL_SLOTS)).toMatchObject({ ok: false, reason: 'sold-out', text: 'Sold out' })
    expect(canBuy('kola-tonic', freshStock(), 10, createInventory(), SATCHEL_SLOTS)).toMatchObject({
      ok: false,
      reason: 'coins',
      shortfall: 8,
      text: 'Need 18 coins, you have 10 (8 short)',
    })
    expect(canBuy('bandage', freshStock(), 100, fullSatchel(), SATCHEL_SLOTS)).toMatchObject({
      ok: false,
      reason: 'full',
      text: 'Your satchel is full',
    })
  })

  it('fits goods into an existing stack in a full satchel', () => {
    let inv = addItem(createInventory(), 'lamp-oil', 1).inv
    for (const f of FILLERS.slice(0, SATCHEL_SLOTS - 1)) inv = addItem(inv, f, 1).inv
    expect(inv.slots.length).toBe(SATCHEL_SLOTS)
    expect(canBuy('lamp-oil', freshStock(), 100, inv, SATCHEL_SLOTS)).toEqual({ ok: true })
  })

  it('refuses a sold-out row and leaves the coins', () => {
    let v = freshStock()
    let coins = 100
    let inv = createInventory()
    for (let i = 0; i < 3; i++) {
      const out = buy('kola-tonic', v, coins, inv, SATCHEL_SLOTS)
      v = out.state
      coins = out.coins
      inv = out.inv
    }
    expect(coins).toBe(82)
    expect(v.stockLeft['kola-tonic']).toBe(0)
  })
})

describe('dawn reset and saves', () => {
  // Feature: 11-horror-pass, Property 24: Vending dawn reset
  it('resets every row to its per-day stock, idempotently', () => {
    fc.assert(
      fc.property(arbStock, (v) => {
        const once = resetAtDawn(v)
        for (const r of VENDING_ROWS) expect(once.stockLeft[r.id]).toBe(r.perDay)
        expect(resetAtDawn(once)).toEqual(once)
        expect(Object.keys(once.stockLeft)).toHaveLength(6)
      }),
      { numRuns: 100 },
    )
  })

  it('sanitises a saved block', () => {
    expect(sanitizeVending(null)).toEqual(freshStock())
    expect(sanitizeVending({ stockLeft: { bandage: 99, 'lamp-oil': -4, 'kola-tonic': 0.7, junk: 3 } }).stockLeft).toMatchObject({
      bandage: 2,
      'lamp-oil': 0,
      'kola-tonic': 0,
      'brisk-draught': 1,
    })
    expect(Object.keys(sanitizeVending({ stockLeft: { junk: 1 } }).stockLeft)).not.toContain('junk')
  })
})

describe('machine', () => {
  it('opens within 2.5 m', () => {
    expect(withinVendingRange({ x: 2.83 - 2.4, z: 1.85 }, [2.83, 0, 1.85])).toBe(true)
    expect(withinVendingRange({ x: 2.83 - 2.6, z: 1.85 }, [2.83, 0, 1.85])).toBe(false)
  })

  it('pulls the handle 5 cm (±1 cm) and springs back within 1.2 s', () => {
    const samples = Array.from({ length: 241 }, (_, i) => purchaseAnimation(i * 0.005))
    const peak = Math.max(...samples)
    expect(peak).toBeGreaterThanOrEqual(VENDING_HANDLE_PULL_M - 0.01)
    expect(peak).toBeLessThanOrEqual(VENDING_HANDLE_PULL_M + 0.01)
    expect(Math.min(...samples)).toBeGreaterThan(-0.01)
    expect(purchaseAnimation(0)).toBe(0)
    expect(purchaseAnimation(VENDING_PURCHASE_S)).toBe(0)
    expect(purchaseAnimation(Number.NaN)).toBe(0)
  })
})
