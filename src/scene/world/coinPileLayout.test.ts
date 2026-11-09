import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { COIN_PILE } from '../../data/graveCoins'
import type { CoinPile } from '../../game/systems/coins'
import { pileInstances } from './coinPileLayout'

const pile = (id: number, age: number, amount = 3): CoinPile => ({ id, x: id, z: 0, amount, age })

describe('pileInstances', () => {
  it('shrinks a pile in its last 2 s and hides it at the fade age', () => {
    const fresh = pileInstances([pile(1, 0)])[0].scale
    const fading = pileInstances([pile(1, COIN_PILE.fadeAfterS - 1)])[0].scale
    expect(fading).toBeCloseTo(fresh * 0.5)
    expect(pileInstances([pile(1, COIN_PILE.fadeAfterS)])).toHaveLength(0)
  })

  it('never returns more than the pile cap and keeps scales finite and non-negative', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.integer({ min: 1, max: 999 }),
            x: fc.double({ min: -50, max: 50, noNaN: true }),
            z: fc.double({ min: -50, max: 50, noNaN: true }),
            amount: fc.integer({ min: 1, max: 40 }),
            age: fc.double({ min: 0, max: 70, noNaN: true }),
          }),
          { maxLength: 60 },
        ),
        (piles) => {
          const out = pileInstances(piles)
          expect(out.length).toBeLessThanOrEqual(COIN_PILE.maxPiles)
          for (const o of out) expect(o.scale).toBeGreaterThan(0)
        },
      ),
    )
  })
})
