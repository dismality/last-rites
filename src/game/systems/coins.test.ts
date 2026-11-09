import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { addPile, coinDrop, pileScale, stepPiles, type CoinPile } from './coins'
import { createRng } from '../rng'
import { COIN_DROPS, COIN_PILE, ELITE_COIN_BONUS } from '../../data/graveCoins'
import type { WaveEnemyId } from '../../data/enemies'

const enemies = Object.keys(COIN_DROPS) as WaveEnemyId[]
const arbEnemy = fc.constantFrom(...enemies)

const arbPile = fc.record({
  id: fc.integer({ min: 0, max: 10_000 }),
  x: fc.double({ min: -50, max: 50, noNaN: true }),
  z: fc.double({ min: -50, max: 50, noNaN: true }),
  amount: fc.integer({ min: 1, max: 50 }),
  age: fc.double({ min: 0, max: 59, noNaN: true }),
})
const arbPiles = fc.array(arbPile, { maxLength: 40 }).map((ps) => ps.map((p, i) => ({ ...p, id: i })))

describe('coinDrop', () => {
  // Feature: progression-and-atmosphere, Property 13: Coin drops follow the table and the seed
  it('Property 13: follows the table and the seed', () => {
    // **Validates: Requirements 4.1, 4.2, 4.3, 4.10**
    fc.assert(
      fc.property(fc.integer(), arbEnemy, fc.boolean(), fc.integer({ min: 0, max: 2 }), (seed, enemy, elite, rank) => {
        const drop = coinDrop(createRng(seed), enemy, elite, rank)
        expect(drop).toBe(coinDrop(createRng(seed), enemy, elite, rank))
        expect(Number.isInteger(drop)).toBe(true)
        const row = COIN_DROPS[enemy]
        const bonus = elite ? ELITE_COIN_BONUS : 0
        const bases = row.chance < 1 ? [bonus, row.amount + bonus] : [row.amount + bonus]
        const allowed = bases.map((b) => Math.floor(b * (1 + 0.25 * rank)))
        expect(allowed).toContain(drop)
        if (enemy === 'shambler' && !elite && drop > 0) expect(drop).toBe(1)
      }),
    )
  })

  it('pays the elite bonus even when the shambler roll fails', () => {
    expect(coinDrop(() => 0.99, 'shambler', true, 0)).toBe(5)
    expect(coinDrop(() => 0.99, 'shambler', false, 0)).toBe(0)
    expect(coinDrop(() => 0, 'brute', false, 2)).toBe(7)
  })
})

describe('piles', () => {
  // Feature: progression-and-atmosphere, Property 14: Coin piles collect once, expire and never lose coins to the cap
  it('Property 14: collect once, expire, and the cap returns the oldest amount', () => {
    // **Validates: Requirements 4.5, 4.6, 4.7, 4.10**
    fc.assert(
      fc.property(
        arbPiles,
        fc.double({ min: -50, max: 50, noNaN: true }),
        fc.double({ min: -50, max: 50, noNaN: true }),
        fc.double({ min: 0, max: 5, noNaN: true }),
        (piles, px, pz, dt) => {
          const r = stepPiles(piles, dt, { x: px, z: pz })
          const near = piles.filter((p) => Math.hypot(p.x - px, p.z - pz) <= COIN_PILE.collectRadiusM)
          expect(r.collected.sort()).toEqual(near.map((p) => p.id).sort())
          for (const p of r.piles) {
            expect(r.collected).not.toContain(p.id)
            expect(p.age).toBeLessThan(COIN_PILE.fadeAfterS)
          }
          // A second step at the same spot never collects the same id again.
          expect(stepPiles(r.piles, dt, { x: px, z: pz }).collected).toEqual([])
        },
      ),
    )
    const far = { x: 1000, z: 1000 }
    const old: CoinPile = { id: 1, x: 0, z: 0, amount: 7, age: 59.5 }
    expect(stepPiles([old], 1, far).piles).toEqual([])
  })

  it('never loses coins when adding at the cap', () => {
    fc.assert(
      fc.property(arbPiles, fc.integer({ min: 1, max: 20 }), (piles, amount) => {
        const total = (ps: readonly CoinPile[]) => ps.reduce((s, p) => s + p.amount, 0)
        const full = Array.from({ length: COIN_PILE.maxPiles }, (_, i) => ({
          id: i,
          x: i * 10,
          z: 0,
          amount: i + 1,
          age: i,
        }))
        const r = addPile(full, 1000, 1000, amount, 99)
        expect(r.piles).toHaveLength(COIN_PILE.maxPiles)
        expect(r.overflow).toBe(full[full.length - 1].amount)
        expect(total(r.piles) + r.overflow).toBe(total(full) + amount)
        const m = addPile(piles, 0, 0, amount, 999)
        expect(total(m.piles) + m.overflow).toBe(total(piles) + amount)
        expect(m.piles.length).toBeLessThanOrEqual(Math.max(piles.length, COIN_PILE.maxPiles))
      }),
    )
  })

  it('merges within 1 m and ignores zero drops', () => {
    const a = addPile([], 0, 0, 3, 1)
    const b = addPile(a.piles, 0.5, 0, 2, 2)
    expect(b.piles).toHaveLength(1)
    expect(b.piles[0].amount).toBe(5)
    expect(addPile(b.piles, 5, 5, 0, 3).piles).toHaveLength(1)
  })

  it('pileScale is 1 then shrinks to 0 over the last 2 s', () => {
    expect(pileScale(0)).toBe(1)
    expect(pileScale(58)).toBe(1)
    expect(pileScale(59)).toBeCloseTo(0.5)
    expect(pileScale(60)).toBe(0)
  })
})
