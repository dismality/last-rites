import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { LANTERN_GLARE_FULL_M, LANTERN_GLARE_MIN_SCALE } from '../../data/balance'
import { lanternIntensity, lanternRadius, tickLantern, wallGlareScale } from './lantern'
import type { LanternState, Phase } from '../types'

const lit = (fuel: number): LanternState => ({ on: true, fuel, flicker: false })

describe('tickLantern', () => {
  it('burns no oil by day or at dawn (spec 09, B3)', () => {
    expect(tickLantern(lit(100), 360, 'day').fuel).toBe(100)
    expect(tickLantern(lit(100), 360, 'day', 2).fuel).toBe(100)
    expect(tickLantern(lit(100), 10, 'dawn').fuel).toBe(100)
  })
  it('drains at the night rate at dusk', () => {
    expect(tickLantern(lit(100), 3, 'dusk').fuel).toBeCloseTo(99)
  })
  it('drains 1% per 3 s by night', () => {
    expect(tickLantern(lit(100), 3, 'night').fuel).toBeCloseTo(99)
  })
  it('does not drain while off', () => {
    expect(tickLantern({ on: false, fuel: 50, flicker: false }, 100, 'night').fuel).toBe(50)
  })
  it('flickers only below 20%', () => {
    expect(tickLantern(lit(20), 0, 'day').flicker).toBe(false)
    expect(tickLantern(lit(19.9), 0, 'day').flicker).toBe(true)
  })
  it('never goes below 0', () => {
    expect(tickLantern(lit(0.1), 1000, 'night').fuel).toBe(0)
  })
})

describe('tickLantern drainMult', () => {
  it('scales the drain and defaults to 1', () => {
    expect(tickLantern(lit(100), 3, 'night', 2).fuel).toBeCloseTo(98)
    expect(tickLantern(lit(100), 3, 'night', 0).fuel).toBe(100)
    expect(tickLantern(lit(100), 3, 'night').fuel).toBeCloseTo(99)
  })
})

describe('lanternRadius', () => {
  it('hits the documented points', () => {
    expect(lanternRadius(100)).toBe(8)
    expect(lanternRadius(50)).toBe(5)
    expect(lanternRadius(0)).toBe(1.5)
  })
})

describe('lantern properties', () => {
  it('radius stays within [1.5, 8]', () => {
    fc.assert(
      fc.property(fc.double({ min: -50, max: 150, noNaN: true }), (f) => {
        const r = lanternRadius(f)
        expect(r).toBeGreaterThanOrEqual(1.5)
        expect(r).toBeLessThanOrEqual(8)
      }),
    )
  })
  it('fuel stays within [0, 100] and ticks are step independent', () => {
    const phase = fc.constantFrom<Phase>('day', 'dusk', 'night', 'dawn')
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 100, noNaN: true }),
        fc.double({ min: 0, max: 500, noNaN: true }),
        fc.double({ min: 0, max: 500, noNaN: true }),
        phase,
        (fuel, a, b, p) => {
          const two = tickLantern(tickLantern(lit(fuel), a, p), b, p)
          const one = tickLantern(lit(fuel), a + b, p)
          expect(one.fuel).toBeGreaterThanOrEqual(0)
          expect(one.fuel).toBeLessThanOrEqual(100)
          expect(two.fuel).toBeCloseTo(one.fuel, 6)
        },
      ),
    )
  })
})

describe('lanternIntensity', () => {
  it('is 1 at full fuel and stays within (0, 1] for any fuel', () => {
    expect(lanternIntensity(100)).toBe(1)
    fc.assert(
      fc.property(fc.double({ min: 0, max: 100, noNaN: true }), (f) => {
        const i = lanternIntensity(f)
        return i > 0 && i <= 1
      })
    )
  })
})

describe('wallGlareScale (spec 09, B8)', () => {
  it('is full brightness with nothing near, and dims a wall at 0.5 m to a sixteenth', () => {
    expect(wallGlareScale(Infinity)).toBe(1)
    expect(wallGlareScale(Number.NaN)).toBe(1)
    expect(wallGlareScale(LANTERN_GLARE_FULL_M)).toBe(1)
    expect(wallGlareScale(1)).toBeCloseTo(0.25)
    // 0.5 m is 4x closer than 2 m, so 16x brighter under inverse square. 1/16 is under the
    // floor, so the wall ends up 1.6x as bright as one at 2 m instead of 16x.
    expect(wallGlareScale(0.5)).toBe(LANTERN_GLARE_MIN_SCALE)
    expect(wallGlareScale(0.5) * 16).toBeCloseTo(1.6)
    expect(wallGlareScale(0)).toBe(LANTERN_GLARE_MIN_SCALE)
  })

  it('property: stays in [min, 1], never darker when the wall is farther, and keeps lit area >= min', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1, max: 10, noNaN: true }),
        fc.double({ min: 0, max: 5, noNaN: true }),
        (d, step) => {
          const a = wallGlareScale(d)
          expect(a).toBeGreaterThanOrEqual(LANTERN_GLARE_MIN_SCALE)
          expect(a).toBeLessThanOrEqual(1)
          expect(wallGlareScale(d + step)).toBeGreaterThanOrEqual(a)
        },
      ),
    )
  })
})
