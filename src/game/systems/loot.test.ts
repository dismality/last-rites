import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { LOOT_TABLES, LOOT_TABLE_MAP } from '../../data/lootTables'
import { createRng } from '../rng'
import { ensureMinimum, rollLoot } from './loot'

describe('rollLoot', () => {
  it('is deterministic for a given seed', () => {
    const t = LOOT_TABLE_MAP['grave-dig']
    expect(rollLoot(t, createRng(42))).toEqual(rollLoot(t, createRng(42)))
  })

  it('returns one stack per roll', () => {
    expect(rollLoot(LOOT_TABLE_MAP['grave-dig'], createRng(1))).toHaveLength(2)
  })

  it('returns nothing for an empty table', () => {
    expect(rollLoot({ id: 'grave-dig', rolls: 3, entries: [] }, createRng(1))).toEqual([])
  })

  // **Validates: Requirements 7.1**
  it('property: quantities are always within the entry min/max', () => {
    fc.assert(
      fc.property(fc.integer(), fc.constantFrom(...LOOT_TABLES), (seed, table) => {
        for (const stack of rollLoot(table, createRng(seed))) {
          const matching = table.entries.filter((e) => e.item === stack.item)
          expect(matching.length).toBeGreaterThan(0)
          expect(matching.some((e) => stack.qty >= e.min && stack.qty <= e.max)).toBe(true)
        }
      }),
    )
  })
})

describe('ensureMinimum', () => {
  it('property: the result holds at least the minimum and keeps every rolled stack', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer({ min: 0, max: 5 }), (seed, min) => {
        const rolled = rollLoot(LOOT_TABLE_MAP['grave-dig'], createRng(seed))
        const out = ensureMinimum(rolled, 'bone', min)
        const bone = out.filter((s) => s.item === 'bone').reduce((n, s) => n + s.qty, 0)
        expect(bone).toBeGreaterThanOrEqual(min)
        expect(out.slice(0, rolled.length)).toEqual(rolled)
        // Only the shortfall is added, never more.
        const before = rolled.filter((s) => s.item === 'bone').reduce((n, s) => n + s.qty, 0)
        expect(bone).toBe(Math.max(before, min))
      }),
    )
  })
})
