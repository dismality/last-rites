import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { MERCHANT_ROWS, MERCHANT_SPOT } from '../../data/merchant'
import { createRng } from '../rng'
import type { MerchantRowId, Phase } from '../types'
import { createInventory, countItem } from './inventory'
import {
  canOpenMerchant,
  dealStock,
  merchantPresent,
  merchantRow,
  tryBuy,
  withinTradeRange,
  type Stock,
} from './merchant'

const phases: Phase[] = ['day', 'dusk', 'night', 'dawn']
const rowIds = MERCHANT_ROWS.map((r) => r.id) as MerchantRowId[]
const owned = fc.record({ revolver: fc.boolean(), shotgun: fc.boolean() })
const stockArb = fc.tuple(fc.integer(), owned).map(([seed, o]) => dealStock(createRng(seed), o))

describe('merchant', () => {
  it('Property 15: Merchant presence and menu gates', () => {
    // **Validates: Requirements 5.4, 5.5, 5.13, 12.10, 13.1, 13.2, 13.3, 13.4**
    fc.assert(
      fc.property(
        fc.constantFrom(...phases),
        fc.double({ min: 0, max: 400, noNaN: true }),
        fc.option(stockArb, { nil: null }),
        fc.boolean(),
        fc.boolean(),
        (phase, phaseTime, stock, majorActive, inRange) => {
          const present = merchantPresent({ phase, phaseTime }, stock)
          expect(present).toBe(stock !== null && phase === 'day' && phaseTime < 90)
          if (phase === 'dusk' || phase === 'night') expect(present).toBe(false)
          expect(canOpenMerchant({ phase, present, majorActive, inRange })).toBe(
            present && inRange && !majorActive,
          )
        },
      ),
    )
  })

  it('trade range is 2.5 m from Silas', () => {
    const [x, , z] = MERCHANT_SPOT.silas
    expect(withinTradeRange({ x: x + 2.5, z })).toBe(true)
    expect(withinTradeRange({ x: x + 2.6, z })).toBe(false)
  })

  it('Property 16: Dealt stock is valid', () => {
    // **Validates: Requirements 5.6, 5.7, 5.14**
    fc.assert(
      fc.property(fc.integer(), owned, (seed, o) => {
        const stock = dealStock(createRng(seed), o)
        const ids = stock.rows.map((r) => r.id)
        expect(ids).toHaveLength(5)
        expect(new Set(ids).size).toBe(5)
        expect(ids.slice(0, 2)).toEqual(['bandage', 'lamp-oil'])
        for (const row of stock.rows) {
          const def = merchantRow(row.id)
          expect(row.qty).toBe(def.dailyQty)
          if (row.id !== 'bandage' && row.id !== 'lamp-oil') expect(def.stock).toBe('pool')
        }
        if (!o.revolver) expect(ids).not.toContain('revolver-cartridges')
        if (!o.shotgun) expect(ids).not.toContain('shotgun-shells')
        expect(dealStock(createRng(seed), o)).toEqual(stock)
      }),
    )
  })

  it('Property 17: Purchases are atomic and conserve value', () => {
    // **Validates: Requirements 5.9, 5.10, 5.15, 5.16**
    fc.assert(
      fc.property(
        stockArb,
        fc.integer({ min: 0, max: 60 }),
        fc.integer({ min: 1, max: 14 }),
        fc.array(fc.constantFrom(...rowIds), { maxLength: 12 }),
        (start, startCoins, slotLimit, buys) => {
          let stock: Stock = start
          let coins = startCoins
          let inv = createInventory()
          for (const id of buys) {
            const before = JSON.stringify({ stock, coins, inv })
            const def = merchantRow(id)
            const qty = stock.rows.find((r) => r.id === id)?.qty ?? 0
            const held = countItem(inv, def.item)
            const r = tryBuy(stock, id, coins, inv, slotLimit)
            if (r.ok) {
              expect(qty).toBeGreaterThan(0)
              expect(r.coins).toBe(coins - def.price)
              expect(r.spent).toBe(def.price)
              expect(r.stock.rows.find((x) => x.id === id)?.qty).toBe(qty - 1)
              expect(countItem(r.inv, def.item)).toBe(held + def.count)
              stock = r.stock
              coins = r.coins
              inv = r.inv
            } else {
              if (qty <= 0) expect(r.reason).toBe('sold-out')
              else if (coins < def.price) expect(r.reason).toBe('coins')
              else expect(r.reason).toBe('space')
            }
            // A refusal changes nothing; inputs are never mutated either way.
            if (!r.ok) expect(JSON.stringify({ stock, coins, inv })).toBe(before)
            expect(coins).toBeGreaterThanOrEqual(0)
            expect(stock.rows.every((x) => x.qty >= 0)).toBe(true)
          }
        },
      ),
    )
  })

  it('refusal text names the coin shortfall', () => {
    const stock: Stock = { rows: [{ id: 'holy-water', qty: 2 }] }
    const r = tryBuy(stock, 'holy-water', 3, createInventory(), 12)
    expect(r).toMatchObject({ ok: false, reason: 'coins', text: 'Need 8 coins, you have 3' })
  })
})
