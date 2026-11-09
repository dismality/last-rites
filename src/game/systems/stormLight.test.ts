import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { LIGHTNING } from '../../data/storms'
import { useWorldStore } from '../state'
import { ambientFlashFactor, flashTint, moonFlashFactor, stormFogDensity } from './stormLight'
import { lightningLevel } from './storm'

describe('stormLight', () => {
  // **Validates: Requirements 10.5, 10.7, 10.8, 12.6**
  it('level 0 changes nothing', () => {
    expect(ambientFlashFactor(0)).toBe(1)
    expect(moonFlashFactor(0)).toBe(1)
    expect(flashTint([0.2, 0.3, 0.4], 0)).toEqual([0.2, 0.3, 0.4])
  })

  it('full flash boosts ambient by 1.4 and moon by 1.6', () => {
    expect(ambientFlashFactor(1)).toBeCloseTo(1.4)
    expect(moonFlashFactor(1)).toBeCloseTo(1.6)
    const [r] = flashTint([0, 0, 0], 1)
    expect(r).toBeCloseTo(0.5 * (0xd6 / 255))
  })

  it('the slow variant never exceeds 30% of the boost', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 5, noNaN: true }), (age) => {
        const level = lightningLevel(age, true)
        expect(ambientFlashFactor(level)).toBeLessThanOrEqual(1 + 0.3 * (LIGHTNING.ambientBoost - 1) + 1e-9)
        expect(moonFlashFactor(level)).toBeLessThanOrEqual(1 + 0.3 * (LIGHTNING.moonBoost - 1) + 1e-9)
      }),
    )
  })

  it('fog adds 0.01 in a storm and the saved fog value is unchanged', () => {
    const before = useWorldStore.getState().fogDensity
    expect(stormFogDensity(before, true)).toBeCloseTo(before + 0.01)
    expect(stormFogDensity(before, false)).toBe(before)
    expect(useWorldStore.getState().fogDensity).toBe(before)
  })
})
