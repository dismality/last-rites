import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { lanternIntensity, lanternRadius, tickLantern } from './lantern'
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
