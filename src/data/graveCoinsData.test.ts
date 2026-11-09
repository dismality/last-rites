import { describe, expect, it } from 'vitest'
import { COIN_DROPS, COIN_PILE, ELITE_COIN_BONUS } from './graveCoins'

describe('grave coin data (§12)', () => {
  it('matches the drop table', () => {
    expect(COIN_DROPS.shambler).toEqual({ amount: 1, chance: 0.5 })
    expect(COIN_DROPS.wailer).toEqual({ amount: 2, chance: 1 })
    expect(COIN_DROPS.lurker).toEqual({ amount: 2, chance: 1 })
    expect(COIN_DROPS.bloater).toEqual({ amount: 2, chance: 1 })
    expect(COIN_DROPS.brute).toEqual({ amount: 5, chance: 1 })
    expect(ELITE_COIN_BONUS).toBe(5)
  })

  it('matches the pile rules', () => {
    expect(COIN_PILE).toEqual({
      collectRadiusM: 1.5,
      fadeAfterS: 60,
      shrinkLastS: 2,
      mergeRadiusM: 1,
      maxPiles: 32,
    })
  })
})
