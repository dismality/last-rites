import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { lagToward, sprintDrop } from './lanternSway'
import { VIEWMODEL_TIMING } from '../../data/viewmodel'

describe('lagToward', () => {
  it('covers about 63% of a step after the lag time', () => {
    const [x] = lagToward([0, 0, 0], [1, 0, 0], VIEWMODEL_TIMING.swayLagS, VIEWMODEL_TIMING.swayLagS)
    expect(x).toBeCloseTo(1 - Math.exp(-1), 5)
  })

  it('does not depend on how the time is split into frames', () => {
    let a: readonly [number, number, number] = [0, 0, 0]
    for (let i = 0; i < 10; i++) a = lagToward(a, [1, 2, 3], 0.01, 0.08)
    const b = lagToward([0, 0, 0], [1, 2, 3], 0.1, 0.08)
    expect(a[0]).toBeCloseTo(b[0], 6)
    expect(a[2]).toBeCloseTo(b[2], 6)
  })

  it('never overshoots the target', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 2, noNaN: true }), fc.double({ min: -5, max: 5, noNaN: true }), (dt, t) => {
        const [x] = lagToward([0, 0, 0], [t, 0, 0], dt, 0.08)
        return Math.abs(x) <= Math.abs(t) + 1e-9
      }),
    )
  })
})

describe('sprintDrop', () => {
  const [lo, hi] = VIEWMODEL_TIMING.sprintDropM
  it('is zero when not sprinting', () => expect(sprintDrop(false, true, 1)).toBe(0))
  it('is constant with Head bob off', () => {
    expect(sprintDrop(true, false, 0)).toBe(lo)
    expect(sprintDrop(true, false, 1)).toBe(lo)
  })
  it('stays within 0.05 to 0.15 m while sprinting', () => {
    fc.assert(
      fc.property(fc.boolean(), fc.double({ noNaN: false }), (bob, amp) => {
        const d = sprintDrop(true, bob, amp)
        return d >= lo && d <= hi
      }),
    )
  })
})
