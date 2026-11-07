import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { MAX_DELTA, STEP, advanceAccumulator } from './fixedStep'

describe('advanceAccumulator', () => {
  it('runs no tick for a sub-step delta and carries the remainder', () => {
    const r = advanceAccumulator(0, STEP / 2)
    expect(r.ticks).toBe(0)
    expect(r.accumulator).toBeCloseTo(STEP / 2)
  })

  it('runs one tick per STEP', () => {
    expect(advanceAccumulator(0, STEP).ticks).toBe(1)
    expect(advanceAccumulator(0, STEP * 3).ticks).toBe(3)
  })

  it('clamps huge deltas to MAX_DELTA', () => {
    const r = advanceAccumulator(0, 10)
    expect(r.ticks).toBe(Math.floor(MAX_DELTA / STEP))
  })

  it('ignores negative deltas', () => {
    expect(advanceAccumulator(0, -1).ticks).toBe(0)
  })

  it('property: remainder stays in [0, STEP) and time is conserved', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: STEP * 0.99, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (acc, delta) => {
          const r = advanceAccumulator(acc, delta)
          const used = Math.min(delta, MAX_DELTA)
          expect(r.accumulator).toBeGreaterThanOrEqual(0)
          expect(r.accumulator).toBeLessThan(STEP + 1e-9)
          expect(r.ticks * STEP + r.accumulator).toBeCloseTo(acc + used, 6)
        }
      )
    )
  })
})
