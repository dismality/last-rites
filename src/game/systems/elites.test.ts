import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { ELITE, ELITE_DROPS } from '../../data/elites'
import type { EnemyId } from '../../data/enemies'
import { createRng } from '../rng'
import type { Inventory, ItemId } from '../types'
import { canBeElite, eliteStats, placeEliteDrop, rollElite, rollEliteDrop } from './elites'
import { addItem, countItem, createInventory } from './inventory'

const ELIGIBLE: EnemyId[] = ['shambler', 'bloater', 'brute']

describe('canBeElite', () => {
  it('needs night 2+, an eligible type and no elite yet', () => {
    expect(canBeElite('shambler', 1, false)).toBe(false)
    expect(canBeElite('shambler', 2, false)).toBe(true)
    expect(canBeElite('shambler', 2, true)).toBe(false)
    expect(canBeElite('wailer', 5, false)).toBe(false)
    expect(canBeElite('lurker', 5, false)).toBe(false)
    expect(canBeElite('father-crane', 5, false)).toBe(false)
  })
})

describe('rollElite', () => {
  it('consumes the rng only when eligible', () => {
    let calls = 0
    const rng = () => (calls++, 0.5)
    rollElite(rng, 'wailer', 3, false)
    rollElite(rng, 'shambler', 1, false)
    rollElite(rng, 'shambler', 3, true)
    expect(calls).toBe(0)
    rollElite(rng, 'shambler', 3, false)
    expect(calls).toBe(1)
  })

  it('never rolls an elite when ineligible, for any seed', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer({ min: 0, max: 1 }), (seed, night) => {
        expect(rollElite(createRng(seed), 'shambler', night, false, 1)).toBe(false)
      }),
    )
  })

  it('hits about the Normal chance over many rolls', () => {
    const rng = createRng(7)
    let hits = 0
    for (let i = 0; i < 10000; i++) if (rollElite(rng, 'brute', 4, false)) hits++
    expect(Math.abs(hits / 10000 - ELITE.chance.normal)).toBeLessThan(0.02)
  })
})

describe('eliteStats', () => {
  it('scales hp, speed and damage', () => {
    const s = eliteStats({ hp: 60, speed: 1.4, damage: 10 })
    expect(s.hp).toBeCloseTo(60 * ELITE.hpMult)
    expect(s.speed).toBeCloseTo(1.4 * ELITE.speedMult)
    expect(s.damage).toBeCloseTo(10 * ELITE.damageMult)
  })
})

describe('Feature: 07-combat-and-enemies, Property 24: Elite drops follow the table and are never lost', () => {
  /** **Validates: Requirements 15.9, 15.10, 15.13** */
  it('every drop is a table entry', () => {
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        const rng = createRng(seed)
        for (let i = 0; i < 20; i++) expect(ELITE_DROPS).toContain(rollEliteDrop(rng))
      }),
    )
  })

  it('10,000 rolls land within 3 points of each weight', () => {
    const rng = createRng(1891)
    const counts = new Map<string, number>()
    const n = 10000
    for (let i = 0; i < n; i++) {
      const d = rollEliteDrop(rng)
      counts.set(d.item, (counts.get(d.item) ?? 0) + 1)
    }
    const total = ELITE_DROPS.reduce((s, d) => s + d.weight, 0)
    for (const d of ELITE_DROPS) {
      const pct = ((counts.get(d.item) ?? 0) / n) * 100
      expect(Math.abs(pct - (d.weight / total) * 100)).toBeLessThanOrEqual(3)
    }
  })

  it('goes to the satchel if it fits, otherwise to the ground, with nothing lost', () => {
    const fill = fc.array(
      fc.constantFrom(
        'bone',
        'iron-nail',
        'candle-wax',
        'holy-water',
        'cloth',
        'lamp-oil',
        'grave-salt',
        'wood-plank',
        'black-powder',
        'lead-shot',
        'silver-filings',
        'revolver-cartridge',
        'shotgun-shell',
      ) as fc.Arbitrary<ItemId>,
      { maxLength: 14 },
    )
    fc.assert(
      fc.property(fc.integer(), fill, (seed, items) => {
        let inv: Inventory = createInventory()
        for (const it of items) inv = addItem(inv, it, 10).inv
        const drop = rollEliteDrop(createRng(seed))
        const at: [number, number, number] = [3, 0, -4]
        const before = countItem(inv, drop.item)
        const out = placeEliteDrop(inv, drop, at, 'drop-1')
        const after = countItem(out.inv, drop.item)
        const grounded = out.ground?.qty ?? 0
        expect(after - before + grounded).toBe(drop.qty)
        if (out.ground) {
          expect(out.ground.position).toEqual(at)
          expect(out.ground.item).toBe(drop.item)
        }
      }),
    )
  })

  it('an empty satchel takes the whole drop', () => {
    const out = placeEliteDrop(createInventory(), ELITE_DROPS[0], [0, 0, 0], 'd')
    expect(out.ground).toBeNull()
    expect(countItem(out.inv, ELITE_DROPS[0].item)).toBe(ELITE_DROPS[0].qty)
  })

  it('eligible list matches the data', () => {
    for (const t of ELIGIBLE) expect(canBeElite(t, ELITE.fromNight, false)).toBe(true)
  })
})
