import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { longestFrame, rampIntensity } from './lightRamp'

describe('rampIntensity', () => {
  it('moves toward the target without overshooting', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 20, noNaN: true }),
        fc.double({ min: 0, max: 20, noNaN: true }),
        fc.double({ min: 0.001, max: 0.1, noNaN: true }),
        (cur, target, dt) => {
          const next = rampIntensity(cur, target, dt, 12)
          const lo = Math.min(cur, target)
          const hi = Math.max(cur, target)
          expect(next).toBeGreaterThanOrEqual(lo - 1e-9)
          expect(next).toBeLessThanOrEqual(hi + 1e-9)
        },
      ),
    )
  })

  it('reaches exactly 0 and the full value eventually', () => {
    let v = 8
    for (let i = 0; i < 120; i++) v = rampIntensity(v, 0, 1 / 60, 12)
    expect(v).toBe(0)
    for (let i = 0; i < 120; i++) v = rampIntensity(v, 8, 1 / 60, 12)
    expect(v).toBe(8)
  })

  it('does nothing with no time passing', () => {
    expect(rampIntensity(3, 8, 0, 12)).toBe(3)
  })
})

describe('longestFrame', () => {
  it('reports the max and 0 for empty', () => {
    expect(longestFrame([16, 700, 17])).toBe(700)
    expect(longestFrame([])).toBe(0)
  })
})
