import { describe, expect, it } from 'vitest'
import {
  FIXED_ROWS,
  MERCHANT_RANGE_M,
  MERCHANT_ROWS,
  MERCHANT_SPOT,
  MERCHANT_STAY_S,
  POOL_ROWS,
} from './merchant'

describe('merchant data (§12)', () => {
  it('has the 10 rows with bible prices and quantities', () => {
    const rows = MERCHANT_ROWS.map((r) => [r.id, r.count, r.price, r.dailyQty, r.stock, r.needs])
    expect(rows).toEqual([
      ['bandage', 1, 6, 3, 'fixed', undefined],
      ['lamp-oil', 1, 4, 3, 'fixed', undefined],
      ['revolver-cartridges', 6, 10, 2, 'pool', 'revolver'],
      ['shotgun-shells', 4, 12, 2, 'pool', 'shotgun'],
      ['holy-water', 1, 8, 2, 'pool', undefined],
      ['black-powder', 1, 6, 3, 'pool', undefined],
      ['lead-shot', 1, 5, 3, 'pool', undefined],
      ['wood-planks', 1, 3, 5, 'pool', undefined],
      ['kola-tonic', 1, 15, 1, 'pool', undefined],
      ['silver-filings', 1, 20, 1, 'pool', undefined],
    ])
  })

  it('splits 2 fixed and 3 drawn rows', () => {
    expect(FIXED_ROWS).toBe(2)
    expect(POOL_ROWS).toBe(3)
    expect(MERCHANT_ROWS.filter((r) => r.stock === 'fixed')).toHaveLength(FIXED_ROWS)
  })

  it('stays 90 s with a 2.5 m trade range', () => {
    expect(MERCHANT_STAY_S).toBe(90)
    expect(MERCHANT_RANGE_M).toBe(2.5)
  })

  it('places the cart and Silas as in the Placements table', () => {
    expect([...MERCHANT_SPOT.cart]).toEqual([-9, 0, 37])
    expect([...MERCHANT_SPOT.silas]).toEqual([-7.2, 0, 36.2])
  })
})
