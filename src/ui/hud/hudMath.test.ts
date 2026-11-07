import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { toFraction, isLowHealth, formatValue } from './hudMath'

describe('hudMath', () => {
  it('maps 0/50/100 to 0/0.5/1', () => {
    expect(toFraction(0)).toBe(0)
    expect(toFraction(50)).toBe(0.5)
    expect(toFraction(100)).toBe(1)
  })

  it('treats NaN as empty', () => {
    expect(toFraction(NaN)).toBe(0)
    expect(formatValue(NaN)).toBe('0')
  })

  it('flags low health strictly below 30', () => {
    expect(isLowHealth(29.9)).toBe(true)
    expect(isLowHealth(30)).toBe(false)
  })

  it('toFraction always lands in [0, 1]', () => {
    fc.assert(
      fc.property(fc.double({ noNaN: true, min: -1e6, max: 1e6 }), (v) => {
        const f = toFraction(v)
        return f >= 0 && f <= 1
      })
    )
  })
})
