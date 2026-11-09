import { describe, expect, it } from 'vitest'
import { modifiersFromRanks } from '../../game/systems/dawnUpgrades'
import { digElapsedS, liveDigDuration } from '../../game/systems/digDuration'
import { DIG_DURATION_S } from '../../data/digging'
import { clampCellIndex, satchelCellCount } from './satchelCells'

describe('satchel cells', () => {
  it('shows 12 cells by default and 14 with Deep Pockets', () => {
    expect(satchelCellCount(modifiersFromRanks({}).satchelSlots)).toBe(12)
    expect(satchelCellCount(modifiersFromRanks({ 'deep-pockets': 1 }).satchelSlots)).toBe(14)
  })

  it('clamps focus to existing cells', () => {
    expect(clampCellIndex(20, 14)).toBe(13)
    expect(clampCellIndex(-1, 14)).toBe(0)
  })
})

describe('dig bar duration', () => {
  it('Gravedigger shortens the dig by 30%', () => {
    const mult = modifiersFromRanks({ gravedigger: 1 }).digTimeMult
    expect(liveDigDuration(mult)).toBeCloseTo(DIG_DURATION_S * 0.7)
    expect(digElapsedS(1, mult)).toBeCloseTo(DIG_DURATION_S * 0.7)
  })
})
