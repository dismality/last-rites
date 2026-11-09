import { describe, expect, it } from 'vitest'
import { DIG_DURATION_S } from '../../data/digging'
import { modifiersFromRanks } from './dawnUpgrades'
import { digElapsedS, liveDigDuration } from './digDuration'

describe('digDuration', () => {
  it('is the base duration with no upgrades', () => {
    expect(liveDigDuration(modifiersFromRanks({}).digTimeMult)).toBe(DIG_DURATION_S)
  })

  it('Gravedigger shortens the dig bar duration by 30%', () => {
    const mult = modifiersFromRanks({ gravedigger: 1 }).digTimeMult
    expect(liveDigDuration(mult)).toBeCloseTo(DIG_DURATION_S * 0.7)
    expect(digElapsedS(1, mult)).toBeCloseTo(DIG_DURATION_S * 0.7)
  })
})
