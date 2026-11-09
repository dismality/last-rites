import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { DAWN_UPGRADES, OFFER_SIZE, UPGRADE_PER_RANK } from '../../data/dawnUpgrades'
import { createRng } from '../rng'
import type { DawnUpgradeId } from '../types'
import {
  IDENTITY_MODIFIERS,
  belowMax,
  modifiersFromRanks,
  offerUpgrades,
  pickUpgrade,
  rankOf,
  upgradeCard,
  type Modifiers,
  type Ranks,
} from './dawnUpgrades'

const ids = DAWN_UPGRADES.map((d) => d.id)
const maxOf = (id: DawnUpgradeId) => DAWN_UPGRADES.find((d) => d.id === id)!.maxRank

const ranksArb: fc.Arbitrary<Ranks> = fc
  .tuple(...DAWN_UPGRADES.map((d) => fc.integer({ min: 0, max: d.maxRank })))
  .map((rs) => Object.fromEntries(ids.map((id, i) => [id, rs[i]])) as Ranks)

describe('dawnUpgrades', () => {
  it('Property 1: offers are valid and seeded', () => {
    // **Validates: Requirements 1.2, 1.3, 1.4, 1.12**
    fc.assert(
      fc.property(ranksArb, fc.integer({ min: 0, max: 2 ** 31 }), (r, seed) => {
        const offer = offerUpgrades(r, createRng(seed))
        expect(new Set(offer).size).toBe(offer.length)
        expect(offer.length).toBe(Math.min(OFFER_SIZE, belowMax(r).length))
        for (const id of offer) expect(rankOf(r, id)).toBeLessThan(maxOf(id))
        expect(offerUpgrades(r, createRng(seed))).toEqual(offer)
      }),
    )
  })

  it('Property 2: a pick changes exactly one rank', () => {
    // **Validates: Requirements 1.6, 1.13**
    fc.assert(
      fc.property(ranksArb, fc.constantFrom(...ids), (r, id) => {
        const next = pickUpgrade(r, id)
        for (const other of ids) {
          if (other === id) continue
          expect(rankOf(next, other)).toBe(rankOf(r, other))
        }
        const expected = Math.min(rankOf(r, id) + 1, maxOf(id))
        expect(rankOf(next, id)).toBe(expected)
        expect(rankOf(next, id)).toBeLessThanOrEqual(maxOf(id))
      }),
    )
  })

  it('Property 3: modifiers are identity at rank 0, follow §12, and never get worse', () => {
    // **Validates: Requirements 1.7, 1.8, 1.9**
    expect(modifiersFromRanks({})).toEqual(IDENTITY_MODIFIERS)
    const k = UPGRADE_PER_RANK
    const better = (key: keyof Modifiers, a: number, b: number) => {
      const lowerIsBetter = ['reloadTimeMult', 'lanternDrainMult', 'digTimeMult']
      return lowerIsBetter.includes(key) ? b <= a : b >= a
    }
    fc.assert(
      fc.property(ranksArb, fc.constantFrom(...ids), (r, id) => {
        const m = modifiersFromRanks(r)
        expect(m.maxHealthBonus).toBeCloseTo(k.maxHealth * rankOf(r, 'iron-constitution'))
        expect(m.reloadTimeMult).toBeCloseTo(1 - k.reload * rankOf(r, 'steady-hands'))
        expect(m.satchelSlots).toBe(IDENTITY_MODIFIERS.satchelSlots + k.satchelSlots * rankOf(r, 'deep-pockets'))
        expect(m.boardHpMult).toBeCloseTo(1 + k.boardHp * rankOf(r, 'hardened-boards'))
        const n = modifiersFromRanks(pickUpgrade(r, id))
        for (const key of Object.keys(m) as (keyof Modifiers)[]) {
          expect(better(key, m[key], n[key])).toBe(true)
        }
      }),
    )
  })

  it('Property 4: upgrade cards are complete', () => {
    // **Validates: Requirements 1.10**
    fc.assert(
      fc.property(ranksArb, fc.constantFrom(...ids), (r, id) => {
        fc.pre(rankOf(r, id) < maxOf(id))
        const card = upgradeCard(r, id)
        expect(card.name.length).toBeGreaterThan(0)
        expect(card.rune.length).toBeGreaterThan(0)
        expect(card.rankText).toBe(`Rank ${rankOf(r, id) + 1}/${maxOf(id)}`)
        expect(card.lines.length).toBeGreaterThan(0)
        for (const line of card.lines) expect(line).toContain(' → ')
      }),
    )
  })

  it('shows the §12 example for Iron Constitution', () => {
    expect(upgradeCard({}, 'iron-constitution').lines).toEqual(['Max health 100 → 115'])
  })
})
